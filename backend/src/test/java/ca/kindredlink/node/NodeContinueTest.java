package ca.kindredlink.node;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import ca.kindredlink.common.ApiException;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class NodeContinueTest {

    @Autowired
    NodeService service;

    private static CreateNodeRequest request(String description, double lat, double lng) {
        return new CreateNodeRequest(description, null, lat, lng);
    }

    @Test
    void continueFromNearbySucceeds() {
        NodeDetail parent = service.createRoot(request("Paid for a coffee", 51.0500, -114.0700), "device-a");

        // ~25 m away, different person
        NodeDetail child = service.continueChain(parent.id(), request("Held a door", 51.0502, -114.0702), "device-b");

        assertEquals(parent.id(), child.parentId());
        assertEquals(parent.chainId(), child.chainId());
        assertEquals(1, child.depth());
    }

    @Test
    void continueFromFarAwayIsRejected() {
        NodeDetail parent = service.createRoot(request("Returned a wallet", 51.0500, -114.0700), "device-a");

        // ~17 km away, much farther than the 1000 m limit
        ApiException error = assertThrows(ApiException.class,
                () -> service.continueChain(parent.id(), request("Too far", 51.2000, -114.0700), "device-b"));

        assertEquals("too_far", error.getBody().getTitle());
    }
}
