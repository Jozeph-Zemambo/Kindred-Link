package ca.kindredlink.node;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import ca.kindredlink.common.ApiException;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;

/** Tests the 12 h window by moving a fake clock forward instead of waiting. */
@SpringBootTest
@ActiveProfiles("test")
class NodeWindowTest {

    /** A clock we can push forward. Replaces the real clock for this test class only. */
    static class MutableClock extends Clock {
        private Instant now = Instant.now();

        void advance(Duration amount) {
            now = now.plus(amount);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock();
        }
    }

    @Autowired
    NodeService service;

    @Autowired
    MutableClock clock;

    private static CreateNodeRequest request(String description) {
        return new CreateNodeRequest(description, null, 51.0500, -114.0700);
    }

    @Test
    void continueJustBeforeWindowClosesSucceeds() {
        NodeDetail parent = service.createRoot(request("Left a kind note"), "device-a");

        clock.advance(Duration.ofHours(11));

        NodeDetail child = service.continueChain(parent.id(), request("Still in time"), "device-b");
        assertEquals(parent.id(), child.parentId());
    }

    @Test
    void continueAfterWindowClosesIsRejected() {
        NodeDetail parent = service.createRoot(request("Gave away gloves"), "device-a");

        clock.advance(Duration.ofHours(13));

        ApiException error = assertThrows(ApiException.class,
                () -> service.continueChain(parent.id(), request("Too late"), "device-b"));
        assertEquals("slot_closed", error.getBody().getTitle());
    }
}
