package ca.kindredlink.node;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import ca.kindredlink.common.ApiException;
import ca.kindredlink.node.NodeDtos.ClaimRequest;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Tests posting your act (continue) now that you have to claim a slot first. */
@SpringBootTest
@ActiveProfiles("test")
class NodeContinueTest {

    @Autowired
    NodeService service;

    private static CreateNodeRequest request(String description, double lat, double lng) {
        return new CreateNodeRequest(description, null, lat, lng);
    }

    /** Runs a post that should fail and returns its error code. */
    private String postError(Long parentId, CreateNodeRequest req, String deviceId) {
        ApiException error = assertThrows(ApiException.class, () -> service.continueChain(parentId, req, deviceId));
        return error.getBody().getTitle();
    }

    @Test
    void claimThenPostFromNearbySucceeds() {
        NodeDetail parent = service.createRoot(request("Paid for a coffee", 51.0500, -114.0700), "device-a");

        // device-b reserves a slot, standing ~25 m away, then posts their act
        service.claim(parent.id(), new ClaimRequest(51.0502, -114.0702), "device-b");
        NodeDetail child = service.continueChain(parent.id(), request("Held a door", 51.0502, -114.0702), "device-b");

        assertEquals(parent.id(), child.parentId());
        assertEquals(parent.chainId(), child.chainId());
        assertEquals(1, child.depth());
    }

    @Test
    void postingWithoutClaimingIsRejected() {
        NodeDetail parent = service.createRoot(request("Left a note", 51.0500, -114.0700), "device-a");

        // device-b is nearby but never claimed a slot
        assertEquals("no_claim", postError(parent.id(), request("Skipped the claim", 51.0501, -114.0701), "device-b"));
    }

    @Test
    void postingFromFarAwayIsRejectedEvenWithAClaim() {
        NodeDetail parent = service.createRoot(request("Returned a wallet", 51.0500, -114.0700), "device-a");
        service.claim(parent.id(), new ClaimRequest(51.0502, -114.0702), "device-b");

        // device-b claimed while nearby, but tries to post from ~17 km away
        assertEquals("too_far", postError(parent.id(), request("Too far", 51.2000, -114.0700), "device-b"));
    }

    @Test
    void postingTwiceOnOneClaimIsRejected() {
        NodeDetail parent = service.createRoot(request("Shovelled a walk", 51.0500, -114.0700), "device-a");
        service.claim(parent.id(), new ClaimRequest(51.0501, -114.0701), "device-b");
        service.continueChain(parent.id(), request("First post", 51.0501, -114.0701), "device-b");

        // One claim means one post
        assertEquals("already_claimed", postError(parent.id(), request("Second post", 51.0501, -114.0701), "device-b"));
    }
}
