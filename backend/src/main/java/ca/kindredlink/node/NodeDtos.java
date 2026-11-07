package ca.kindredlink.node;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** Request/response shapes for /api/nodes. Mirrored by frontend/src/api/types.ts. */
public final class NodeDtos {
    private NodeDtos() {}

    /** Body for POST /api/nodes and POST /api/nodes/{id}/continue. lat/lng is the device's real GPS fix. */
    public record CreateNodeRequest(
            @NotBlank @Size(max = 500) String description,
            @Size(max = 2000) String photoUrl,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng) {}

    /** A public map pin. Only approximate coordinates. */
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
            boolean mine) {}

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
