package ca.kindredlink.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

/** Plain unit tests (no Spring), so they run instantly. */
class DeviceIdTest {

    /** Runs require() on a bad id and returns the error code the app would see. */
    private String errorCodeFor(String raw) {
        ApiException error = assertThrows(ApiException.class, () -> DeviceId.require(raw));
        return error.getBody().getTitle();
    }

    @Test
    void normalIdsAreAccepted() {
        assertEquals("dev-m3k9x2a-k4f8h2lq", DeviceId.require("dev-m3k9x2a-k4f8h2lq")); // the app's style
        assertEquals("matt-phone", DeviceId.require("matt-phone"));
        assertEquals("a", DeviceId.require("a")); // shortest allowed
    }

    @Test
    void missingIdIsRejected() {
        assertEquals("bad_device_id", errorCodeFor(null));
    }

    @Test
    void blankOrEmptyIdIsRejected() {
        assertEquals("bad_device_id", errorCodeFor(""));
        assertEquals("bad_device_id", errorCodeFor("   "));
    }

    @Test
    void idsWithSpacesOrOddCharactersAreRejected() {
        assertEquals("bad_device_id", errorCodeFor("my phone"));
        assertEquals("bad_device_id", errorCodeFor("id;drop table"));
    }

    @Test
    void tooLongIdIsRejected() {
        assertEquals("bad_device_id", errorCodeFor("a".repeat(101)));
        assertEquals("a".repeat(100), DeviceId.require("a".repeat(100))); // exactly 100 is fine
    }
}
