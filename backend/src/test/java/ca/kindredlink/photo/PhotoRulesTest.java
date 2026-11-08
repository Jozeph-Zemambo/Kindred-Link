package ca.kindredlink.photo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ca.kindredlink.chain.ChainService;
import ca.kindredlink.common.ApiException;
import ca.kindredlink.node.NodeDtos.ClaimRequest;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import ca.kindredlink.node.NodeDtos.NodePin;
import ca.kindredlink.node.NodeRepository;
import ca.kindredlink.node.NodeService;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test") // in-memory database, and the moderator key is "test-key"
class PhotoRulesTest {

    @Autowired
    PhotoService photoService;

    @Autowired
    NodeService nodeService;

    @Autowired
    ChainService chains;

    @Autowired
    NodePhotoRepository photos;

    @Autowired
    NodeRepository nodes;

    private static final double LAT = 51.0500;
    private static final double LNG = -114.0700;
    private static final String MODERATOR = "test-key";

    // ---- small helpers so each test stays short ----

    // Uploads a tiny real picture as the given device and returns the photo id.
    private Long upload(String device) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(40, 40, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return photoService.upload(out.toByteArray(), device).id();
    }

    // Starts a new chain with an optional photo.
    private NodeDetail newChain(String device, Long photoId) {
        return nodeService.createRoot(new CreateNodeRequest("A kind deed", photoId, LAT, LNG), device);
    }

    // Looks up one node's pin on the discovery map, as the given viewer.
    private NodePin pinFor(Long nodeId, String viewer) {
        return nodeService.listPins(LAT, LNG, 2000, false, viewer).stream()
                .filter(p -> p.id().equals(nodeId)).findFirst().orElseThrow();
    }

    // Runs something that should fail and returns its error code.
    private String errorCode(Runnable action) {
        return assertThrows(ApiException.class, action::run).getBody().getTitle();
    }

    // ---- attaching a photo to a node ----

    @Test
    void photoIsLinkedToTheNodeItWasPostedWith() throws IOException {
        // Checks the photo remembers which node it belongs to.
        Long photoId = upload("dev-a");
        NodeDetail node = newChain("dev-a", photoId);

        assertEquals(node.id(), photos.findById(photoId).orElseThrow().getNodeId());
    }

    @Test
    void cannotAttachSomeoneElsesPhoto() throws IOException {
        // Checks you can't use a photo that another device uploaded.
        Long photoId = upload("dev-a");

        assertEquals("not_your_photo", errorCode(() -> newChain("dev-b", photoId)));
    }

    @Test
    void cannotAttachTheSamePhotoTwice() throws IOException {
        // Checks one photo can only belong to one node.
        Long photoId = upload("dev-a");
        newChain("dev-a", photoId);

        assertEquals("photo_used", errorCode(() -> newChain("dev-a", photoId)));
    }

    @Test
    void unknownPhotoIdIsRejected() {
        // Checks a made-up photo id gives not_found.
        assertEquals("not_found", errorCode(() -> newChain("dev-a", 999_999L)));
    }

    @Test
    void failedAttachDoesNotLeaveAHalfMadeNode() throws IOException {
        // Checks a bad photo means no node is created either (everything is rolled back).
        long before = nodes.count();
        Long photoId = upload("dev-a");

        errorCode(() -> newChain("dev-b", photoId));

        assertEquals(before, nodes.count());
    }

    @Test
    void photoCanBePostedWhenContinuingAChain() throws IOException {
        // Checks the continue step accepts a photo too.
        NodeDetail root = newChain("dev-a", null);
        nodeService.claim(root.id(), new ClaimRequest(LAT, LNG), "dev-b");
        Long photoId = upload("dev-b");

        NodeDetail child = nodeService.continueChain(root.id(), new CreateNodeRequest("My deed", photoId, LAT, LNG), "dev-b");

        assertEquals(child.id(), photos.findById(photoId).orElseThrow().getNodeId());
    }

    // ---- who can see a photo: everyone, once it is approved ----

    @Test
    void pendingPhotoIsHiddenFromEveryoneEvenTheOwner() throws IOException {
        // Checks a photo nobody has approved yet shows no link.
        NodeDetail node = newChain("dev-a", upload("dev-a"));

        assertNull(nodeService.get(node.id(), "dev-a").photoUrl());
        assertNull(nodeService.get(node.id(), "dev-stranger").photoUrl());
    }

    @Test
    void approvedPhotoShowsToEveryone() throws IOException {
        // Checks after approval the owner, a stranger and a viewer with no device id all get the link.
        Long photoId = upload("dev-a");
        NodeDetail node = newChain("dev-a", photoId);
        photoService.approve(photoId, MODERATOR);

        String expected = "/api/photos/" + photoId;
        assertEquals(expected, nodeService.get(node.id(), "dev-a").photoUrl());
        assertEquals(expected, nodeService.get(node.id(), "dev-stranger").photoUrl());
        assertEquals(expected, nodeService.get(node.id(), null).photoUrl());
    }

    @Test
    void discoveryMapShowsApprovedPhotosToEveryone() throws IOException {
        // Checks the map where you look for nodes to join shows hasPhoto once approved, not before.
        Long photoId = upload("dev-a");
        NodeDetail node = newChain("dev-a", photoId);

        assertFalse(pinFor(node.id(), "dev-stranger").hasPhoto());

        photoService.approve(photoId, MODERATOR);

        assertTrue(pinFor(node.id(), "dev-stranger").hasPhoto());
        assertTrue(pinFor(node.id(), "dev-a").hasPhoto());
    }

    @Test
    void chainMapShowsApprovedPhotosToEveryone() throws IOException {
        // Checks the chain map also flags the photo for everyone once approved.
        Long photoId = upload("dev-a");
        NodeDetail node = newChain("dev-a", photoId);
        photoService.approve(photoId, MODERATOR);

        assertTrue(chains.tree(node.chainId(), "dev-a").nodes().getFirst().hasPhoto());
        assertTrue(chains.tree(node.chainId(), "dev-stranger").nodes().getFirst().hasPhoto());
    }

    // ---- fetching the picture itself ----

    @Test
    void pictureIsServedToAnyoneOnceApproved() throws IOException {
        // Checks the image endpoint hides a pending photo and serves an approved one to anybody.
        Long photoId = upload("dev-a");
        newChain("dev-a", photoId);

        assertEquals("not_found", errorCode(() -> photoService.view(photoId, null)));

        photoService.approve(photoId, MODERATOR);

        assertNotNull(photoService.view(photoId, null));
    }

    @Test
    void moderatorCanSeeAPendingPicture() throws IOException {
        // Checks a moderator with the right key can look at a photo before deciding.
        Long photoId = upload("dev-a");
        newChain("dev-a", photoId);

        assertNotNull(photoService.view(photoId, MODERATOR));
        assertEquals("not_found", errorCode(() -> photoService.view(photoId, "wrong-key")));
    }

    // ---- moderation ----

    @Test
    void approvingNeedsTheModeratorKey() throws IOException {
        // Checks no key or a wrong key can't approve, and the right key can.
        Long photoId = upload("dev-a");

        assertEquals("not_moderator", errorCode(() -> photoService.approve(photoId, null)));
        assertEquals("not_moderator", errorCode(() -> photoService.approve(photoId, "wrong-key")));
        assertEquals(PhotoStatus.APPROVED, photoService.approve(photoId, MODERATOR).status());
    }

    @Test
    void rejectedPhotoNeverShows() throws IOException {
        // Checks a rejected photo stays hidden from everyone, including the owner.
        Long photoId = upload("dev-a");
        NodeDetail node = newChain("dev-a", photoId);

        assertEquals(PhotoStatus.REJECTED, photoService.reject(photoId, MODERATOR).status());

        assertNull(nodeService.get(node.id(), "dev-a").photoUrl());
        assertEquals("not_found", errorCode(() -> photoService.view(photoId, null)));
    }

    @Test
    void moderatorQueueListsOnlyPendingPhotos() throws IOException {
        // Checks the queue shows waiting photos and drops the ones already decided.
        Long waiting = upload("dev-a");
        Long decided = upload("dev-a");
        photoService.approve(decided, MODERATOR);

        var queueIds = photoService.pending(MODERATOR).stream().map(p -> p.id()).toList();

        assertTrue(queueIds.contains(waiting));
        assertFalse(queueIds.contains(decided));
        assertEquals("not_moderator", errorCode(() -> photoService.pending(null)));
    }
}
