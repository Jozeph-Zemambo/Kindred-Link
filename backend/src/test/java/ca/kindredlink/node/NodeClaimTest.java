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
 * must be nearby to claim, and a node stays claimable until its chain ends (not for a fixed 12 h).
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

    /** Runs a claim that should fail, and returns its error code. */
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

        // ~17 km north of the node, well beyond the 2 km claim radius.
        assertEquals("too_far", claimError(parent.id(), new ClaimRequest(LAT + 0.15, LNG), "device-b"));
    }

    @Test
    void unclaimedNodeStaysClaimableForDays() {
        NodeDetail parent = newParent();

        // Nobody claims it for 3 days. A node doesn't expire after 12 h: it lasts as long as its chain.
        clock.advance(Duration.ofDays(3));

        // Claiming still works, and the 12 h deadline starts from this claim, not from when the node was made.
        ClaimResponse claim = service.claim(parent.id(), nearby(), "device-b");
        assertEquals(claim.claimedAt().plus(Duration.ofHours(12)), claim.finishBy());
    }

    @Test
    void nodeStaysOpenUntilItsChainEnds() {
        NodeDetail parent = newParent();

        clock.advance(Duration.ofDays(3));

        // Still both slots open, and the pin's closesAt is the chain's 7-day end, not 12 h after creation.
        NodePin pin = service.listPins(LAT, LNG, 2000, false, "device-a").stream()
                .filter(p -> p.id().equals(parent.id())).findFirst().orElseThrow();
        assertEquals(2, pin.openSlots());
        assertEquals(parent.createdAt().plus(Duration.ofDays(7)), pin.closesAt());
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

    @Autowired
    NodeRepository nodes; // lets the test save nodes directly, skipping the claim step

    @Test
    void nodeWithTwoChildrenButNoClaimsIsFull() {
        NodeDetail parent = newParent();

        // Save 2 children straight into the database with no claims, like the demo seed data does.
        // (KindnessNode args: chainId, parentId, depth, device, text, photo, lat, lng, approxLat, approxLng, time)
        for (String device : new String[] {"seed-1", "seed-2"}) {
            nodes.save(new KindnessNode(parent.chainId(), parent.id(), 1, device, "Seeded child", null,
                    LAT, LNG, LAT, LNG, clock.instant()));
        }

        // The window is still open, but both slots are used by real children, so a claim must fail.
        assertEquals("slot_closed", claimError(parent.id(), nearby(), "device-b"));
    }

    @Autowired
    ca.kindredlink.chain.ChainService chains; // the service behind GET /api/chains/{id}

    @Test
    void chainMapCountsClaimsAsUsedSlots() {
        NodeDetail parent = newParent();

        // Two people claim, nobody has posted yet, so there are no children.
        service.claim(parent.id(), nearby(), "device-b");
        service.claim(parent.id(), nearby(), "device-c");

        // The chain map must agree with the pins: both slots are taken, so 0 open.
        var root = chains.tree(parent.chainId(), "device-a").nodes().getFirst();
        assertEquals(0, root.openSlots());
        assertEquals(0, pinFor(parent.id()).openSlots());
    }

    @Test
    void pinCountdownStopsAtTheChainsSevenDayEnd() {
        // A chain started 6 days 22 h ago, so it hits its 7-day hard stop in 2 h.
        java.time.Instant now = clock.instant();
        KindnessNode root = nodes.save(new KindnessNode(null, null, 0, "seed-root", "Old root", null,
                LAT, LNG, LAT, LNG, now.minus(Duration.ofDays(7)).plus(Duration.ofHours(2))));
        root.setChainId(root.getId());
        nodes.save(root); // no transaction in tests, so save again to store the chainId

        // A fresh link posted 1 h ago, when the chain had only 3 h left.
        KindnessNode child = nodes.save(new KindnessNode(root.getId(), root.getId(), 1, "seed-child", "New link",
                null, LAT, LNG, LAT, LNG, now.minus(Duration.ofHours(1))));

        // A node lasts as long as what's left of its chain, so its countdown stops at the chain's
        // end (2 h from now), however long ago or recently it was created.
        NodePin pin = pinFor(child.getId());
        assertEquals(root.getCreatedAt().plus(Duration.ofDays(7)), pin.closesAt());
        assertEquals(2, pin.openSlots());

        // 3 h later the chain is over: the pin shows 0 open slots and a claim is rejected.
        clock.advance(Duration.ofHours(3));
        assertEquals(0, pinFor(child.getId()).openSlots());
        assertEquals("chain_ended", claimError(child.getId(), nearby(), "device-b"));
    }
}
