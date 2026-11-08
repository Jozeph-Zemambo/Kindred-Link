package ca.kindredlink.business;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/**
 * Transparency bands from how long ago a business's last act of kindness was.
 * Whole-bubble opacity: 1.0 within the hour, 0.8 within a day, 0.5 within a
 * week, 0.25 for anything older or when no linked act has ever been recorded.
 * Ordinary checkins do not refresh this - only checkins linked to a node.
 */
public final class BusinessActivity {

    private BusinessActivity() {}

    public static double opacity(Instant lastKindnessAt, Instant now) {
        Objects.requireNonNull(now, "now");
        if (lastKindnessAt == null) {
            return 0.25;
        }
        Duration age = Duration.between(lastKindnessAt, now);
        if (age.compareTo(Duration.ofHours(1)) <= 0) {
            return 1.0;
        }
        if (age.compareTo(Duration.ofHours(24)) <= 0) {
            return 0.8;
        }
        if (age.compareTo(Duration.ofHours(168)) <= 0) {
            return 0.5;
        }
        return 0.25;
    }
}
