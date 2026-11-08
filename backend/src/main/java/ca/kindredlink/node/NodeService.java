package ca.kindredlink.node;

import ca.kindredlink.KindredProperties;
import ca.kindredlink.common.ApiException;
import ca.kindredlink.geo.Geo;
import ca.kindredlink.node.NodeDtos.ClaimRequest;
import ca.kindredlink.node.NodeDtos.ClaimResponse;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import ca.kindredlink.node.NodeDtos.NodePin;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NodeService {

    private final NodeRepository nodes;
    private final NodeClaimRepository claims; // who has reserved which slot
    private final NodeRules rules;
    private final KindredProperties props;
    private final Clock clock;

    public NodeService(NodeRepository nodes, NodeClaimRepository claims, NodeRules rules,
            KindredProperties props, Clock clock) {
        this.nodes = nodes;
        this.claims = claims;
        this.rules = rules;
        this.props = props;
        this.clock = clock;
    }

    /** Pins within radiusMeters of (lat, lng), or every node authored by deviceId when mine is set. */
    public List<NodePin> listPins(Double lat, Double lng, double radiusMeters, boolean mine, String deviceId) {
        List<KindnessNode> found;
        if (mine) {
            found = nodes.findByAuthorDeviceIdOrderByCreatedAtDesc(deviceId);
        } else if (lat != null && lng != null) {
            double dLat = radiusMeters / 111_320;
            double dLng = radiusMeters / (111_320 * Math.cos(Math.toRadians(lat)));
            found = nodes.findByApproxLatBetweenAndApproxLngBetween(lat - dLat, lat + dLat, lng - dLng, lng + dLng)
                    .stream()
                    .filter(n -> Geo.distanceMeters(lat, lng, n.getApproxLat(), n.getApproxLng()) <= radiusMeters)
                    .toList();
        } else {
            found = nodes.findAll();
        }
        // Two batch lookups (one query each) instead of one query per pin.
        Map<Long, Long> childCounts = childCounts(found);
        Map<Long, Long> claimCounts = claimCounts(found);
        Map<Long, Instant> chainEnds = chainEnds(found); // 7-day hard stop per chain, one query
        Instant now = clock.instant();
        return found.stream()
                .map(n -> {
                    long children = childCounts.getOrDefault(n.getId(), 0L);
                    long claimed = claimCounts.getOrDefault(n.getId(), 0L);
                    Instant chainEnd = chainEnds.get(n.getChainId());
                    return new NodePin(
                            n.getId(), n.getChainId(), n.getParentId(), n.getApproxLat(), n.getApproxLng(),
                            rules.openSlots(rules.usedSlots(claimed, children), now, chainEnd),
                            // A node stays claimable until its chain ends, so that's its closesAt.
                            n.getCreatedAt(), chainEnd, n.getPhotoUrl() != null,
                            Objects.equals(n.getAuthorDeviceId(), deviceId),
                            (int) children);
                })
                .toList();
    }

    public NodeDetail get(Long id, String deviceId) {
        KindnessNode n = nodes.findById(id).orElseThrow(() -> ApiException.notFound("Node", id));
        return toDetail(n, deviceId);
    }

    @Transactional
    public NodeDetail createRoot(CreateNodeRequest req, String deviceId) {
        KindnessNode root = nodes.save(newNode(null, null, 0, req, deviceId));
        root.setChainId(root.getId());
        return toDetail(root, deviceId);
    }

    /**
     * Reserve one of the parent's two slots for this device.
     *
     * How the rules fit together:
     *  - A node can be claimed any time until its CHAIN ends (7 days after the chain's first node),
     *    not for a fixed 12 h. A node made with 3 days left on its chain stays open for 3 days.
     *  - Each claim uses up a slot permanently, finished or not, so a slot whose claimer never
     *    posts is never handed to someone else.
     *  - The moment you claim, you get 12 h (finishHours) to post your act, capped at the chain's end.
     *
     * Checks run in this order: chain still open, own node, already claimed, slots left, distance.
     */
    @Transactional
    public ClaimResponse claim(Long parentId, ClaimRequest req, String deviceId) {
        // Load the parent AND lock its row. If two people tap "claim" at the same instant, the
        // database makes them take turns, so both can't grab the last slot.
        KindnessNode parent = nodes.findByIdForUpdate(parentId)
                .orElseThrow(() -> ApiException.notFound("Node", parentId));
        Instant now = clock.instant(); // the Clock bean, so tests can fake the time

        // Rule: the whole chain must still be open (7-day hard stop). We keep the chain's end time
        // so the finish deadline below can never run past it.
        Instant chainEnd = requireChainOpen(parent, now);

        // Rule: you can't claim your own act of kindness.
        if (parent.getAuthorDeviceId().equals(deviceId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "own_node", "You can't claim your own act of kindness");
        }
        // Rule: one claim per person per node (the database enforces this too, via the unique rule).
        if (claims.findByNodeIdAndDeviceId(parentId, deviceId).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "already_claimed", "You already claimed this node");
        }
        // Rule: a slot must be free. countByNodeId counts every claim ever made, finished or not,
        // which is what makes an abandoned slot stay closed. (There is no separate claim window any
        // more: the chain-still-open check above is the only time limit on claiming.)
        // A slot is used if someone claimed it OR a child already exists (demo data has children but
        // no claims). rules.usedSlots() is the same helper the map pins use, so the pin and this rule agree.
        long used = rules.usedSlots(claims.countByNodeId(parentId), nodes.countByParentId(parentId));
        if (used >= props.node().maxChildren()) {
            throw new ApiException(HttpStatus.CONFLICT, "slot_closed", "No slots left on this node");
        }
        // Rule: be physically near the node. Uses the real GPS fix, never shown to other users.
        double distance = Geo.distanceMeters(parent.getLat(), parent.getLng(), req.lat(), req.lng());
        double max = props.continueRules().maxDistanceMeters();
        if (distance > max) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "too_far",
                    "You need to be within " + (int) max + " m of this node to claim it");
        }

        // All rules passed: save the claim and tell the app the finish deadline. That's 12 h from now
        // (finishHours), unless the chain's 7-day hard stop comes first, so the app never promises
        // time that doesn't exist.
        claims.save(new NodeClaim(parentId, deviceId, now));
        Instant finishWindowEnd = now.plus(Duration.ofHours(props.node().finishHours()));
        Instant finishBy = finishWindowEnd.isBefore(chainEnd) ? finishWindowEnd : chainEnd;
        return new ClaimResponse(now, finishBy);
    }

    /**
     * Post your act as the next link under parentId. You have to claim a slot first (see claim),
     * and then finish inside your own 12 hours.
     */
    @Transactional
    public NodeDetail continueChain(Long parentId, CreateNodeRequest req, String deviceId) {
        // Grab the parent and lock it, so two requests can't trip over each other.
        KindnessNode parent = nodes.findByIdForUpdate(parentId)
                .orElseThrow(() -> ApiException.notFound("Node", parentId));
        Instant now = clock.instant();

        // Rule: the whole chain must still be open (7-day hard stop), even if you hold a claim.
        requireChainOpen(parent, now);

        // Did this person actually claim a slot? If not, they can't post yet.
        NodeClaim claim = claims.findByNodeIdAndDeviceId(parentId, deviceId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "no_claim",
                        "Claim this node first, then post your act"));

        // They already posted for this claim, so no second post.
        if (claim.getChildId() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "already_claimed",
                    "You already finished your act for this node");
        }

        // Their personal 12 hours start the moment they claimed. Too late means the slot is lost for good.
        Instant deadline = claim.getClaimedAt().plus(Duration.ofHours(props.node().finishHours()));
        if (!now.isBefore(deadline)) {
            throw new ApiException(HttpStatus.CONFLICT, "claim_expired",
                    "Your " + props.node().finishHours() + " h to finish ran out, so this slot is closed");
        }

        // Still be near the node when you post, not just when you claimed.
        double distance = Geo.distanceMeters(parent.getLat(), parent.getLng(), req.lat(), req.lng());
        double max = props.continueRules().maxDistanceMeters();
        if (distance > max) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "too_far",
                    "You need to be within " + (int) max + " m of this node to post");
        }

        // All good: save the new node, then note on the claim that it's finished.
        // (No explicit save for the claim: the transaction writes the change when the method ends.)
        KindnessNode child = nodes.save(newNode(parent.getChainId(), parent.getId(), parent.getDepth() + 1, req, deviceId));
        claim.setChildId(child.getId());
        return toDetail(child, deviceId);
    }

    /**
     * Hard stop: a chain stops accepting links 7 days after its first (root) node, even if people
     * are still linking. Throws chain_ended if that moment has passed; otherwise returns it, so
     * claim() can cap its finish deadline. Every node stores its chain's root id in chainId.
     */
    private Instant requireChainOpen(KindnessNode node, Instant now) {
        KindnessNode root = nodes.findById(node.getChainId())
                .orElseThrow(() -> ApiException.notFound("Chain", node.getChainId()));
        Instant chainEnd = rules.chainEndsAt(root);
        if (!now.isBefore(chainEnd)) {
            throw new ApiException(HttpStatus.CONFLICT, "chain_ended",
                    "This chain has ended (" + props.chain().maxDays() + " day limit)");
        }
        return chainEnd;
    }

    private KindnessNode newNode(Long chainId, Long parentId, int depth, CreateNodeRequest req, String deviceId) {
        Geo.LatLng approx = Geo.approximate(req.lat(), req.lng(), props.privacy().gridMeters());
        return new KindnessNode(chainId, parentId, depth, deviceId, req.description().strip(), req.photoUrl(),
                req.lat(), req.lng(), approx.lat(), approx.lng(), clock.instant());
    }

    private NodeDetail toDetail(KindnessNode n, String deviceId) {
        List<Long> childIds = nodes.findByParentIdOrderByCreatedAtAsc(n.getId()).stream()
                .map(KindnessNode::getId)
                .toList();
        // The chain's 7-day hard stop, from its root (for a root node, the root is itself).
        KindnessNode root = n.isRoot() ? n : nodes.findById(n.getChainId())
                .orElseThrow(() -> ApiException.notFound("Chain", n.getChainId()));
        Instant chainEnd = rules.chainEndsAt(root);
        return new NodeDetail(
                n.getId(), n.getChainId(), n.getParentId(), n.getDepth(), n.getDescription(), n.getPhotoUrl(),
                n.getApproxLat(), n.getApproxLng(),
                rules.openSlots(rules.usedSlots(claims.countByNodeId(n.getId()), childIds.size()),
                        clock.instant(), chainEnd),
                n.getCreatedAt(), chainEnd, childIds, // closesAt = the chain's end

                Objects.equals(n.getAuthorDeviceId(), deviceId));
    }

    /**
     * Each chain's 7-day end time, keyed by chainId, for a list of nodes. Loads all the roots in
     * one query (a root's id is its chainId) instead of one lookup per pin.
     */
    Map<Long, Instant> chainEnds(List<KindnessNode> found) {
        List<Long> chainIds = found.stream().map(KindnessNode::getChainId).distinct().toList();
        return nodes.findAllById(chainIds).stream()
                .collect(Collectors.toMap(KindnessNode::getId, rules::chainEndsAt));
    }

    /** Claim counts for many nodes in one query. Nodes with no claims are missing from the map. */
    Map<Long, Long> claimCounts(List<KindnessNode> parents) {
        if (parents.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = parents.stream().map(KindnessNode::getId).toList();
        return claims.countClaims(ids).stream()
                .collect(Collectors.toMap(NodeClaimRepository.ClaimCount::getNodeId,
                        NodeClaimRepository.ClaimCount::getCount));
    }

    Map<Long, Long> childCounts(List<KindnessNode> parents) {
        if (parents.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = parents.stream().map(KindnessNode::getId).toList();
        return nodes.countChildren(ids).stream()
                .collect(Collectors.toMap(NodeRepository.ChildCount::getParentId, NodeRepository.ChildCount::getCount));
    }
}
