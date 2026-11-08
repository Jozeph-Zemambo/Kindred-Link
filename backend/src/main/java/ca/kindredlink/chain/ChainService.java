package ca.kindredlink.chain;

import ca.kindredlink.KindredProperties;
import ca.kindredlink.chain.ChainDtos.ChainNode;
import ca.kindredlink.chain.ChainDtos.ChainStats;
import ca.kindredlink.chain.ChainDtos.ChainStatus;
import ca.kindredlink.chain.ChainDtos.ChainTree;
import ca.kindredlink.common.ApiException;
import ca.kindredlink.geo.Geo;
import ca.kindredlink.node.KindnessNode;
import ca.kindredlink.node.NodeClaimRepository;
import ca.kindredlink.node.NodeRepository;
import ca.kindredlink.node.NodeRules;
import ca.kindredlink.photo.PhotoService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ChainService {

    private final NodeRepository nodes;
    private final NodeClaimRepository claims; // claims use up slots, so open-slot counts need them
    private final PhotoService photoService; // which nodes have a photo this viewer may see
    private final NodeRules rules;
    private final KindredProperties props;
    private final Clock clock;

    public ChainService(NodeRepository nodes, NodeClaimRepository claims, PhotoService photoService,
            NodeRules rules, KindredProperties props, Clock clock) {
        this.nodes = nodes;
        this.claims = claims;
        this.photoService = photoService;
        this.rules = rules;
        this.props = props;
        this.clock = clock;
    }

    public ChainTree tree(Long chainId, String deviceId) {
        List<KindnessNode> all = load(chainId);
        Map<Long, Integer> slots = openSlots(all);
        // hasPhoto is true for nodes with an APPROVED photo, for everyone.
        Set<Long> visiblePhotos = photoService.nodesWithApprovedPhoto(all.stream().map(KindnessNode::getId).toList());
        List<ChainNode> out = all.stream()
                .map(n -> new ChainNode(n.getId(), n.getParentId(), n.getDepth(), n.getApproxLat(), n.getApproxLng(),
                        n.getCreatedAt(), slots.get(n.getId()), visiblePhotos.contains(n.getId()),
                        Objects.equals(n.getAuthorDeviceId(), deviceId)))
                .toList();
        return new ChainTree(chainId, status(all, slots), out);
    }

    public ChainStats stats(Long chainId) {
        List<KindnessNode> all = load(chainId);
        Map<Long, Integer> slots = openSlots(all);
        Map<Long, KindnessNode> byId = all.stream().collect(Collectors.toMap(KindnessNode::getId, Function.identity()));

        // Distance is summed over real coordinates: a total doesn't reveal anyone's location.
        double distance = all.stream()
                .filter(n -> n.getParentId() != null)
                .mapToDouble(n -> {
                    KindnessNode p = byId.get(n.getParentId());
                    return Geo.distanceMeters(p.getLat(), p.getLng(), n.getLat(), n.getLng());
                })
                .sum();
        int neighbourhoods = (int) all.stream().map(n -> Geo.neighbourhoodKey(n.getLat(), n.getLng())).distinct().count();
        int maxDepth = all.stream().mapToInt(KindnessNode::getDepth).max().orElse(0);
        int open = slots.values().stream().mapToInt(Integer::intValue).sum();

        return new ChainStats(chainId, status(all, slots), all.size(), Math.round(distance * 10) / 10.0,
                neighbourhoods, maxDepth, open, all.getFirst().getCreatedAt(), all.getLast().getCreatedAt());
    }

    /**
     * ENDED: no node anywhere in the chain can take another link.
     * QUIET: slots are open, but nobody has added a link for quietAfterHours.
     * ACTIVE: otherwise.
     */
    private ChainStatus status(List<KindnessNode> all, Map<Long, Integer> slots) {
        if (slots.values().stream().allMatch(s -> s == 0)) {
            return ChainStatus.ENDED;
        }
        Instant lastLink = all.getLast().getCreatedAt();
        Duration quietAfter = Duration.ofHours(props.chain().quietAfterHours());
        return lastLink.plus(quietAfter).isBefore(clock.instant()) ? ChainStatus.QUIET : ChainStatus.ACTIVE;
    }

    private List<KindnessNode> load(Long chainId) {
        List<KindnessNode> all = nodes.findByChainIdOrderByCreatedAtAsc(chainId);
        if (all.isEmpty()) {
            throw ApiException.notFound("Chain", chainId);
        }
        return all;
    }

    /**
     * Open slots for every node in the chain. A slot is used by a claim (even an unfinished one) or
     * by a child that already exists, the same rule the map pins and the claim endpoint use.
     */
    private Map<Long, Integer> openSlots(List<KindnessNode> all) {
        // Children per node: we already have the whole chain in memory, so just count parentIds.
        Map<Long, Long> childCounts = new HashMap<>();
        all.stream().filter(n -> n.getParentId() != null).forEach(n -> childCounts.merge(n.getParentId(), 1L, Long::sum));

        // Claims per node: one query for the whole chain (nodes with no claims are missing from the map).
        List<Long> ids = all.stream().map(KindnessNode::getId).toList();
        Map<Long, Long> claimCounts = claims.countClaims(ids).stream()
                .collect(Collectors.toMap(NodeClaimRepository.ClaimCount::getNodeId,
                        NodeClaimRepository.ClaimCount::getCount));

        // The 7-day hard stop. `all` is ordered by createdAt, so the first node is the root.
        Instant chainEnd = rules.chainEndsAt(all.getFirst());

        Instant now = clock.instant();
        return all.stream().collect(Collectors.toMap(KindnessNode::getId,
                n -> rules.openSlots(rules.usedSlots(
                        claimCounts.getOrDefault(n.getId(), 0L),
                        childCounts.getOrDefault(n.getId(), 0L)), now, chainEnd)));
    }
}
