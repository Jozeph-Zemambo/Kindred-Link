package ca.kindredlink.photo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import ca.kindredlink.common.ApiException;
import ca.kindredlink.photo.PhotoDtos.PhotoUploadResponse;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test") // use the in-memory test database
class PhotoServiceTest {

    @Autowired
    PhotoService service;

    @Autowired
    NodePhotoRepository photos;

    // Makes a small JPEG that carries a fake hidden GPS block, like a real phone photo.
    private static byte[] jpegWithHiddenGps() throws IOException {
        ByteArrayOutputStream plain = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB), "jpg", plain);
        byte[] jpeg = plain.toByteArray();

        byte[] payload = "Exif\0\0FAKE-GPS-51.05N-114.07W".getBytes(StandardCharsets.ISO_8859_1);
        int segmentLength = payload.length + 2;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg[0]);
        out.write(jpeg[1]);
        out.write(0xFF);
        out.write(0xE1); // the spot where phones put EXIF
        out.write(segmentLength >> 8);
        out.write(segmentLength & 0xFF);
        out.writeBytes(payload);
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    @Test
    void uploadedPhotoStartsPendingAndIsSavedUnderTheUploader() throws IOException {
        // Checks a new photo gets an id, starts as PENDING, and remembers who uploaded it.
        PhotoUploadResponse response = service.upload(jpegWithHiddenGps(), "device-a");

        assertNotNull(response.id());
        assertEquals(PhotoStatus.PENDING, response.status());
        NodePhoto saved = photos.findById(response.id()).orElseThrow();
        assertEquals("device-a", saved.getUploaderDeviceId());
        assertEquals(PhotoStatus.PENDING, saved.getStatus());
    }

    @Test
    void storedPhotoHasNoHiddenGps() throws IOException {
        // Checks the saved image bytes no longer contain the fake GPS data.
        PhotoUploadResponse response = service.upload(jpegWithHiddenGps(), "device-a");

        byte[] stored = photos.findById(response.id()).orElseThrow().getData();
        String storedText = new String(stored, StandardCharsets.ISO_8859_1);
        assertFalse(storedText.contains("FAKE-GPS"));
        assertFalse(storedText.contains("Exif"));
    }

    @Test
    void nonImageUploadIsRejectedAndNothingIsSaved() {
        // Checks a text file is turned away with bad_photo, and no photo row is created.
        long before = photos.count();
        byte[] notAnImage = "just some text".getBytes(StandardCharsets.UTF_8);

        ApiException error = assertThrows(ApiException.class, () -> service.upload(notAnImage, "device-a"));

        assertEquals("bad_photo", error.getBody().getTitle());
        assertEquals(before, photos.count());
    }

    @Test
    void eachUploadGetsItsOwnId() throws IOException {
        // Checks two uploads become two separate photos.
        PhotoUploadResponse first = service.upload(jpegWithHiddenGps(), "device-a");
        PhotoUploadResponse second = service.upload(jpegWithHiddenGps(), "device-a");

        assertNotEquals(first.id(), second.id());
    }
}
