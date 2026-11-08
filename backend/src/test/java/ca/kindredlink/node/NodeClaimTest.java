package ca.kindredlink.node;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import ca.kindredlink.common.ApiException;
import ca.kindredlink.node.NodeDtos.ClaimRequest;
import ca.kindredlink.node.NodeDtos.ClaimResponse;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import ca.kindredlink.node.NodeDtos.NodePin;
import ca.kindredlink.node.NodeWindowTest.MutableClock;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;

/**
 * Tests the claim rules: 2 slots per node, one claim per person, no claiming your own node,
 * must be nearby, and the claim window closes 12 h after the parent was created.
 * Every test creates its own parent node, so the tests don't interfere with each other.
 */
@SpringBootTest
@ActiveProfiles("test") // use the in-memory test database, not MySQL
class NodeClaimTest {

    /** Swaps in a clock we can push forward. Reuses the fake clock from NodeWindowTest. */
    @TestConfiguration
    static class TestClockConfig {
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

    // A spot in Calgary. Nodes and claims use nearby coordinates unless a test says otherwise.
    private static final double LAT = 51.0500;
    private static final double LNG = -114.0700;

    /** Creates a fresh parent node owned by "device-a". */
    private NodeDetail newParent() {
        return service.createRoot(new CreateNodeRequest("Paid for a coffee", null, LAT, LNG), "device-a");
    }

    /** A claim request from a spot ~25 m from the parent. */
    private static ClaimRequest nearby() {
        return new ClaimRequest(LAT + 0.0002, LNG + 0.0002);
    }

    /** Runs a claim that should fail, and returns its error code (e.g. "too_far"). */
    private String claimError(Long parentId, ClaimRequest req, String deviceId) {
        ApiException error = assertThrows(ApiException.class, () -> service.claim(parentId, req, deviceId));
        return error.getBody().getTitle();
    }

    @Test
    void twoDifferentPeopleCanClaim() {
        NodeDetail parent = newParent();

        ClaimResponse first = service.claim(parent.id(), nearby(), "device-b");
        service.claim(parent.id(), nearby(), "device-c"); // second slot, no error expected

        // The finish deadline is 12 h after the claim moment.
        assertEquals(first.claimedAt().plus(Duration.ofHours(12)), first.finishBy());
    }

    @Test
    void thirdClaimIsRejectedBecauseNodeIsFull() {
        NodeDetail parent = newParent();
        service.claim(parent.id(), nearby(), "device-b");
        service.claim(parent.id(), nearby(), "device-c");

        assertEquals("slot_closed", claimError(parent.id(), nearby(), "device-d"));
    }

    @Test
    void samePersonCannotClaimTwice() {
        NodeDetail parent = newParent();
        service.claim(parent.id(), nearby(), "device-b");

        assertEquals("already_claimed", claimError(parent.id(), nearby(), "device-b"));
    }

    @Test
    void cannotClaimYourOwnNode() {
        NodeDetail parent = newParent(); // created by device-a

        assertEquals("own_node", claimError(parent.id(), nearby(), "device-a"));
    }

    @Test
    void cannotClaimFromFarAway() {
        NodeDetail parent = newParent();

        // ~17 km north of the node, well beyond the allowed distance
        assertEquals("too_far", claimError(parent.id(), new ClaimRequest(LAT + 0.15, LNG), "device-b"));
    }

    @Test
    void cannotClaimAfterClaimWindowCloses() {
        NodeDetail parent = newParent();

        clock.advance(Duration.ofHours(13)); // past the 12 h claim window

        assertEquals("slot_closed", claimError(parent.id(), nearby(), "device-b"));
    }

    /** Looks up one node's pin the way the map would (all pins near the spot, then pick ours). */
    private NodePin pinFor(Long nodeId) {
        return service.listPins(LAT, LNG, 2000, false, "device-a").stream()
                .filter(p -> p.id().equals(nodeId))
                .findFirst()
                .orElseThrow();
    }

    @Test
    void claimingASlotLowersOpenSlotsOnThePin() {
        NodeDetail parent = newParent();
        assertEquals(2, pinFor(parent.id()).openSlots());

        service.claim(parent.id(), nearby(), "device-b");
        assertEquals(1, pinFor(parent.id()).openSlots());

        service.claim(parent.id(), nearby(), "device-c");
        assertEquals(0, pinFor(parent.id()).openSlots());
    }

    @Test
    void childCountOnlyCountsPeopleWhoActuallyPosted() {
        NodeDetail parent = newParent();
        service.claim(parent.id(), nearby(), "device-b");
        service.claim(parent.id(), nearby(), "device-c");

        // Both claimed, but only device-b posts
        service.continueChain(parent.id(), new CreateNodeRequest("I did it", null, LAT, LNG), "device-b");

        NodePin pin = pinFor(parent.id());
        assertEquals(1, pin.childCount());
        assertEquals(0, pin.openSlots());
    }
}
