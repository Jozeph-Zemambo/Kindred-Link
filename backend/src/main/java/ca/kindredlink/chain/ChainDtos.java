package ca.kindredlink.chain;

import java.time.Instant;
import java.util.List;

/** Response shapes for /api/chains. Mirrored by frontend/src/api/types.ts. */
public final class ChainDtos {
    private ChainDtos() {}

    public enum ChainStatus { ACTIVE, QUIET, ENDED }

    /**
     * Whole tree as a flat list, ordered by createdAt (so the replay is just "reveal in order").
     * Draw a line from each node to its parentId to get the A→B→C→D map.
     */
    public record ChainTree(Long chainId, ChainStatus status, List<ChainNode> nodes) {}

    public record ChainNode(
            Long id,
            Long parentId,
            int depth,
            double lat,
            double lng,
            Instant createdAt,
            int openSlots,
            boolean hasPhoto,
            boolean mine) {}

    public record ChainStats(
            Long chainId,
            ChainStatus status,
            int links,
            double totalDistanceMeters,
            int neighbourhoodsReached,
            int maxDepth,
            int openSlots,
            Instant startedAt,
            Instant lastLinkAt) {}
}
