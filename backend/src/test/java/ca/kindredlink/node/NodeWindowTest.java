package ca.kindredlink.node;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import ca.kindredlink.common.ApiException;
import ca.kindredlink.node.NodeDtos.ClaimRequest;
import ca.kindredlink.node.NodeDtos.ClaimResponse;
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

/** Tests the 12 h finish deadline (after claiming) and the 7-day chain limit by moving a fake clock forward. */
@SpringBootTest
@ActiveProfiles("test")
class NodeWindowTest {

    /** A clock we can push forward. Replaces the real clock for this test class only. */
    static class MutableClock extends Clock {
        // Start on a whole millisecond. Windows clocks give 7 digits after the second but the test
        // database keeps 6 and rounds, which can make a saved createdAt land a hair LATER than the
        // clock. A test that jumps exactly 12 h or 7 days would then sit just before the deadline.
        private Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);

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

    // ---- 7-day hard stop for the whole chain ----

    @Test
    void claimAfterSevenDaysIsRejectedBecauseChainEnded() {
        NodeDetail parent = service.createRoot(request("Left a note"), "device-a");

        clock.advance(Duration.ofDays(7));

        ApiException error = assertThrows(ApiException.class,
                () -> service.claim(parent.id(), claimHere(), "device-b"));
        assertEquals("chain_ended", error.getBody().getTitle());
    }

    @Test
    void postingAfterSevenDaysIsRejectedEvenWithAClaim() {
        NodeDetail parent = service.createRoot(request("Shared an umbrella"), "device-a");
        service.claim(parent.id(), claimHere(), "device-b"); // claimed on day 0

        clock.advance(Duration.ofDays(7));

        ApiException error = assertThrows(ApiException.class,
                () -> service.continueChain(parent.id(), request("Too late"), "device-b"));
        assertEquals("chain_ended", error.getBody().getTitle());
    }

    @Test
    void finishDeadlineIsCappedAtTheChainsSevenDayMark() {
        NodeDetail root = service.createRoot(request("Started a long chain"), "device-a");

        // Keep the chain alive: every 10 h a new person claims and posts. After 16 hops it is
        // hour 160 (day 6.67) and the newest node was created just now.
        NodeDetail latest = root;
        for (int i = 1; i <= 16; i++) {
            clock.advance(Duration.ofHours(10));
            service.claim(latest.id(), claimHere(), "hop-" + i);
            latest = service.continueChain(latest.id(), request("Link " + i), "hop-" + i);
        }

        // One more person claims at hour 161. 12 h later would be hour 173, past the 7-day mark
        // (hour 168), so the deadline must be cut back to exactly day 7 after the chain started.
        clock.advance(Duration.ofHours(1));
        ClaimResponse claim = service.claim(latest.id(), claimHere(), "last-person");

        Instant sevenDayMark = root.createdAt().plus(Duration.ofDays(7));
        long millisOff = Math.abs(Duration.between(sevenDayMark, claim.finishBy()).toMillis());
        // Tolerance of 1 ms because the database stores times slightly rounded.
        assertEquals(true, millisOff < 1, "finishBy should be the 7-day mark, but was " + claim.finishBy());
    }
}
