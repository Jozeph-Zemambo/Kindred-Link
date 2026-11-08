package ca.kindredlink.node;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** Request/response shapes for /api/nodes. Mirrored by frontend/src/api/types.ts. */
public final class NodeDtos {
    private NodeDtos() {}

    /**
     * Body for POST /api/nodes and POST /api/nodes/{id}/continue. lat/lng is the device's real GPS fix.
     * photoId (optional) is the id returned by POST /api/photos. The server checks you uploaded it and
     * links it to the new node. There is no free-text photo link, so every picture goes through moderation.
     */
    public record CreateNodeRequest(
            @NotBlank @Size(max = 500) String description,
            @Positive Long photoId,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng) {}

    /**
     * Body for POST /api/nodes/{id}/claim. The coordinates record the claim location for the
     * resulting contribution; claiming itself is not restricted by distance.
     * The @NotNull / @Decimal... lines make Spring reject a missing or impossible coordinate
     * before our code runs (input validation).
     */
    public record ClaimRequest(
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng) {}

    /**
     * What the app gets back after a successful claim: when the claim started and the deadline
     * by which the person must post their act (claimedAt + 12 h). The app shows finishBy as a countdown.
     */
    public record ClaimResponse(Instant claimedAt, Instant finishBy) {}

    /**
     * A public map pin: the small summary of a node that the map gets from GET /api/nodes, one per
     * dot on the map. Tapping a pin opens the full NodeDetail. Only approximate coordinates are
     * shown, never the real location.
     *
     * Two fields are easy to mix up:
     *  - openSlots: how many slots can still be CLAIMED (2 minus claims taken; 0 once the chain's
     *    7-day end has passed). closesAt is that chain end.
     *  - childCount: how many children actually POSTED their act (a claim that isn't finished yet
     *    doesn't count). A node has at most 2 children.
     * Example: two people claimed, one posted, one is still working on it. openSlots = 0 (both
     * slots taken) but childCount = 1 (only one has posted).
     */
    public record NodePin(
            Long id,
            Long chainId,
            Long parentId,
            double lat,
            double lng,
            int openSlots,
            Instant createdAt,
            Instant closesAt,
            boolean hasPhoto,
            boolean mine,
            int childCount) {} // children who actually posted (max 2), not people who only claimed

    public record NodeDetail(
            Long id,
            Long chainId,
            Long parentId,
            int depth,
            String description,
            String photoUrl,
            double lat,
            double lng,
            int openSlots,
            Instant createdAt,
            Instant closesAt,
            List<Long> childIds,
            boolean mine) {}
}
