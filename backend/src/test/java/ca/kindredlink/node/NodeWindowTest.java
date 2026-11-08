package ca.kindredlink.node;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import ca.kindredlink.common.ApiException;
import ca.kindredlink.node.NodeDtos.ClaimRequest;
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

    /** A claim request from the same spot as the parent (distance is not what these tests are about). */
    private static ClaimRequest claimHere() {
        return new ClaimRequest(51.0500, -114.0700);
    }

    @Test
    void lateClaimerStillGetsAFullTwelveHours() {
        NodeDetail parent = service.createRoot(request("Left a kind note"), "device-a");

        // Claim 6 h after the parent was made, then finish 11 h later. That's 17 h after the parent
        // (past its own 12 h) but only 11 h after the claim, so it must still work.
        clock.advance(Duration.ofHours(6));
        service.claim(parent.id(), claimHere(), "device-b");
        clock.advance(Duration.ofHours(11));

        NodeDetail child = service.continueChain(parent.id(), request("Still in time"), "device-b");
        assertEquals(parent.id(), child.parentId());
    }

    @Test
    void postingAfterYourOwnTwelveHoursIsRejected() {
        NodeDetail parent = service.createRoot(request("Gave away gloves"), "device-a");
        service.claim(parent.id(), claimHere(), "device-b");

        clock.advance(Duration.ofHours(13)); // longer than the 12 h you were given

        ApiException error = assertThrows(ApiException.class,
                () -> service.continueChain(parent.id(), request("Too late"), "device-b"));
        assertEquals("claim_expired", error.getBody().getTitle());
    }

    @Test
    void abandonedSlotIsNeverGivenToSomeoneElse() {
        NodeDetail parent = service.createRoot(request("Paid a parking meter"), "device-a");

        // Two people claim both slots. Only device-b actually posts. device-c disappears.
        service.claim(parent.id(), claimHere(), "device-b");
        service.claim(parent.id(), claimHere(), "device-c");
        service.continueChain(parent.id(), request("I did mine"), "device-b");

        clock.advance(Duration.ofHours(13));

        // device-c ran out of time, and a newcomer can't take over their slot
        ApiException tooLate = assertThrows(ApiException.class,
                () -> service.continueChain(parent.id(), request("Late"), "device-c"));
        assertEquals("claim_expired", tooLate.getBody().getTitle());

        ApiException newcomer = assertThrows(ApiException.class,
                () -> service.claim(parent.id(), claimHere(), "device-d"));
        assertEquals("slot_closed", newcomer.getBody().getTitle());

        // The parent ends up with exactly one child
        assertEquals(1, service.get(parent.id(), "device-a").childIds().size());
    }
}
