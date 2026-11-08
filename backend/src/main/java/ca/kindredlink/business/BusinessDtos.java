package ca.kindredlink.business;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

/** Request/response shapes for /api/businesses. Mirrored by frontend/src/api/types.ts. */
public final class BusinessDtos {
    private BusinessDtos() {}

    /**
     * The bubble on the map: logo plus how many visited and how many did a kindness there.
     * diameterUnits is a logical bubble diameter (see BusinessBubbleSize) - the frontend
     * maps units to pixels, it is not a pixel or inch value. lastKindnessAt is the
     * createdAt of the newest checkin linked to a kindness node (ordinary scans do
     * not count); opacity is the whole-bubble transparency band for that recency
     * (see BusinessActivity).
     */
    public record BusinessHub(Long id, String name, String logoUrl, double lat, double lng,
            long visitors, long kindnessActs, double diameterUnits,
            Instant lastKindnessAt, double opacity) {}

    /** token comes from the scanned till QR; lat/lng is the device's GPS fix; nodeId links an act. */
    public record CheckinRequest(
            @NotBlank String token,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
            Long nodeId) {}

    public record CheckinResult(Long checkinId, BusinessHub business) {}
}
