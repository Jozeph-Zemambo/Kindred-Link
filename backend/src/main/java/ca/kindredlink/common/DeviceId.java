package ca.kindredlink.common;

import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/**
 * Legacy validation helper for demo data and old unit tests. Production HTTP endpoints
 * now derive user identity from verified Auth0 JWTs; this header is NEVER trusted.
 */
public final class DeviceId {
    public static final String HEADER = "X-Device-Id";

    // Allowed ids: 1-100 characters, only letters, digits and . _ : -
    // (the app's ids like "dev-m3k9x2a-k4f8h2lq" fit this).
    private static final Pattern VALID = Pattern.compile("[A-Za-z0-9._:-]{1,100}");

    private DeviceId() {}

    /**
     * Returns the id if it's usable, otherwise throws a clear error the app can read:
     * {"status":400,"title":"bad_device_id",...}. Because the device id is the only way we tell
     * people apart, a blank or junk one would make different phones look like the same person.
     */
    public static String require(String raw) {
        if (raw == null || !VALID.matcher(raw).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "bad_device_id",
                    "Send an " + HEADER + " header of 1-100 letters, digits, or . _ : -");
        }
        return raw;
    }
}
