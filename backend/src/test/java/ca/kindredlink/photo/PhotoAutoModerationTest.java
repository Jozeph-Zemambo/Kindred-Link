package ca.kindredlink.photo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ca.kindredlink.common.ApiException;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import ca.kindredlink.node.NodeDtos.NodePin;
import ca.kindredlink.node.NodeService;
import ca.kindredlink.photo.PhotoDtos.PhotoUploadResponse;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Upload-time automatic screening, end to end against the in-memory database. The real
 * GoogleVisionSafetyChecker is replaced by a mock, so no Google calls ever happen and the
 * approved/pending decisions are fully controlled.
 */
@SpringBootTest
@ActiveProfiles("test")
class PhotoAutoModerationTest {

    private static final double LAT = 51.0500;
    private static final double LNG = -114.0700;
    private static final String MODERATOR = "test-key";

    @Autowired
    PhotoService photoService;

    @Autowired
    NodeService nodeService;

    @Autowired
    NodePhotoRepository photos;

    @MockitoBean
    PhotoSafetyChecker safety;

    @BeforeEach
    void resetChecker() {
        reset(safety);
    }

    private static byte[] jpeg() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(40, 40, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }

    // Same fake-EXIF carrier as PhotoServiceTest: a real JPEG with a hidden block inside.
    private static byte[] jpegWithHiddenGps() throws IOException {
        byte[] jpeg = jpeg();
        byte[] payload = "Exif\0\0FAKE-GPS-51.05N-114.07W".getBytes(StandardCharsets.ISO_8859_1);
        int segmentLength = payload.length + 2;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg[0]);
        out.write(jpeg[1]);
        out.write(0xFF);
        out.write(0xE1);
        out.write(segmentLength >> 8);
        out.write(segmentLength & 0xFF);
        out.writeBytes(payload);
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    private NodePin pinFor(Long nodeId, String viewer) {
        return nodeService.listPins(LAT, LNG, 2000, false, viewer).stream()
                .filter(p -> p.id().equals(nodeId)).findFirst().orElseThrow();
    }

    @Test
    void safePhotoIsApprovedBeforeSaving() throws IOException {
        when(safety.isSafe(any())).thenReturn(true);

        PhotoUploadResponse response = photoService.upload(jpeg(), "dev-a");

        assertEquals(PhotoStatus.APPROVED, response.status());
        assertEquals(PhotoStatus.APPROVED, photos.findById(response.id()).orElseThrow().getStatus());
    }

    @Test
    void unsafePhotoStaysPending() throws IOException {
        when(safety.isSafe(any())).thenReturn(false);

        PhotoUploadResponse response = photoService.upload(jpeg(), "dev-a");

        assertEquals(PhotoStatus.PENDING, response.status());
        assertEquals(PhotoStatus.PENDING, photos.findById(response.id()).orElseThrow().getStatus());
    }

    @Test
    void checkerThrowingStillSavesPending() throws IOException {
        when(safety.isSafe(any())).thenThrow(new RuntimeException("checker exploded"));

        PhotoUploadResponse response = photoService.upload(jpeg(), "dev-a");

        assertEquals(PhotoStatus.PENDING, response.status());
        assertEquals(PhotoStatus.PENDING, photos.findById(response.id()).orElseThrow().getStatus());
    }

    @Test
    void checkerSeesTheCleanedJpegNotTheUpload() throws IOException {
        AtomicReference<byte[]> seen = new AtomicReference<>();
        when(safety.isSafe(any())).thenAnswer(inv -> {
            seen.set(inv.getArgument(0));
            return true;
        });

        photoService.upload(jpegWithHiddenGps(), "dev-a");

        byte[] checked = seen.get();
        assertNotNull(checked, "checker must be called");
        String text = new String(checked, StandardCharsets.ISO_8859_1);
        assertFalse(text.contains("FAKE-GPS"), "hidden GPS must be stripped before screening");
        assertFalse(text.contains("Exif"), "EXIF must be stripped before screening");
        assertNotNull(ImageIO.read(new java.io.ByteArrayInputStream(checked)), "still a valid JPEG");
    }

    @Test
    void badPhotoIsRejectedBeforeAnyScreening() {
        byte[] notAnImage = "just some text".getBytes(StandardCharsets.UTF_8);

        ApiException error = assertThrows(ApiException.class, () -> photoService.upload(notAnImage, "dev-a"));

        assertEquals("bad_photo", error.getBody().getTitle());
        verify(safety, never()).isSafe(any());
    }

    @Test
    void approvedUploadAttachesAndIsPubliclyVisible() throws IOException {
        when(safety.isSafe(any())).thenReturn(true);
        Long photoId = photoService.upload(jpeg(), "dev-a").id();
        NodeDetail node = nodeService.createRoot(new CreateNodeRequest("A kind deed", photoId, LAT, LNG), "dev-a");

        String expected = "/api/photos/" + photoId;
        assertEquals(expected, node.photoUrl());
        assertEquals(expected, nodeService.get(node.id(), "dev-stranger").photoUrl());
        assertTrue(pinFor(node.id(), "dev-stranger").hasPhoto());
        assertNotNull(photoService.view(photoId, null));
    }

    @Test
    void pendingUploadStaysHiddenUntilManualApprove() throws IOException {
        when(safety.isSafe(any())).thenReturn(false);
        Long photoId = photoService.upload(jpeg(), "dev-a").id();
        NodeDetail node = nodeService.createRoot(new CreateNodeRequest("A kind deed", photoId, LAT, LNG), "dev-a");

        assertNull(node.photoUrl());
        assertNull(nodeService.get(node.id(), "dev-stranger").photoUrl());
        assertFalse(pinFor(node.id(), "dev-stranger").hasPhoto());

        // The manual moderator path is untouched and still rescues the photo.
        assertEquals(PhotoStatus.APPROVED, photoService.approve(photoId, MODERATOR).status());
        assertEquals("/api/photos/" + photoId, nodeService.get(node.id(), "dev-stranger").photoUrl());
        assertTrue(pinFor(node.id(), "dev-stranger").hasPhoto());
    }
}
