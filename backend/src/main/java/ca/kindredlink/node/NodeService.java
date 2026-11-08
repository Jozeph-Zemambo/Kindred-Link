package ca.kindredlink.node;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ca.kindredlink.KindredProperties;
import ca.kindredlink.common.ApiException;
import ca.kindredlink.geo.Geo;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import ca.kindredlink.node.NodeDtos.NodePin;

@Service
@Transactional(readOnly = true)
public class NodeService {

    private final NodeRepository nodes;
    private final NodeRules rules;
    private final KindredProperties props;
    private final Clock clock;

    public NodeService(NodeRepository nodes, NodeRules rules, KindredProperties props, Clock clock) {
        this.nodes = nodes;
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
        Map<Long, Long> childCounts = childCounts(found);
        Instant now = clock.instant();
        return found.stream()
                .map(n -> new NodePin(
                        n.getId(), n.getChainId(), n.getParentId(), n.getApproxLat(), n.getApproxLng(),
                        rules.openSlots(n, childCounts.getOrDefault(n.getId(), 0L), now),
                        n.getCreatedAt(), rules.closesAt(n), n.getPhotoUrl() != null,
                        Objects.equals(n.getAuthorDeviceId(), deviceId)))
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
     * Add the next link under parentId. Rules, in order: the parent must have an open slot, you
     * can't continue your own node, and your real GPS fix must be near the parent's real location.
     */
    @Transactional
    public NodeDetail continueChain(Long parentId, CreateNodeRequest req, String deviceId) {
        KindnessNode parent = nodes.findByIdForUpdate(parentId)
                .orElseThrow(() -> ApiException.notFound("Node", parentId));

        long children = nodes.countByParentId(parentId);
        if (rules.openSlots(parent, children, clock.instant()) == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "slot_closed",
                    "This node is full or its " + props.node().openHours() + " h window has closed");
        }
        if (parent.getAuthorDeviceId().equals(deviceId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "own_node", "You can't continue your own act of kindness");
        }
        double distance = Geo.distanceMeters(parent.getLat(), parent.getLng(), req.lat(), req.lng());
        double max = props.continueRules().maxDistanceMeters();
        if (distance > max) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "too_far",
                    "You need to be within " + (int) max + " m of this node to continue it");
        }

        KindnessNode child = nodes.save(newNode(parent.getChainId(), parent.getId(), parent.getDepth() + 1, req, deviceId));
        return toDetail(child, deviceId);
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
        return new NodeDetail(
                n.getId(), n.getChainId(), n.getParentId(), n.getDepth(), n.getDescription(), n.getPhotoUrl(),
                n.getApproxLat(), n.getApproxLng(), rules.openSlots(n, childIds.size(), clock.instant()),
                n.getCreatedAt(), rules.closesAt(n), childIds, Objects.equals(n.getAuthorDeviceId(), deviceId));
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
