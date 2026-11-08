package ca.kindredlink.business;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class BusinessActivityTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");

    @Test
    void opacityBandsAreExact() {
        assertEquals(0.25, BusinessActivity.opacity(null, NOW));
        assertEquals(1.0, BusinessActivity.opacity(NOW, NOW));
        assertEquals(1.0, BusinessActivity.opacity(NOW.minusSeconds(1800), NOW));
        assertEquals(1.0, BusinessActivity.opacity(NOW.minusSeconds(3600), NOW));
        assertEquals(0.8, BusinessActivity.opacity(NOW.minusNanos(3_600_000_000_001L), NOW));
        assertEquals(0.8, BusinessActivity.opacity(NOW.minusSeconds(86400), NOW));
        assertEquals(0.5, BusinessActivity.opacity(NOW.minusNanos(86_400_000_000_001L), NOW));
        assertEquals(0.5, BusinessActivity.opacity(NOW.minusSeconds(604800), NOW));
        assertEquals(0.25, BusinessActivity.opacity(NOW.minusNanos(604_800_000_000_001L), NOW));
    }

    @Test
    void futureTimestampReadsAsFresh() {
        assertEquals(1.0, BusinessActivity.opacity(NOW.plusSeconds(300), NOW));
    }
}
