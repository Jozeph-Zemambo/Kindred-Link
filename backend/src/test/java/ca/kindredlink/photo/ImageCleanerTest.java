package ca.kindredlink.photo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ca.kindredlink.common.ApiException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/** Plain unit tests (no Spring). They check ImageCleaner strips hidden data and rejects bad uploads. */
class ImageCleanerTest {

    /** Makes a real image of the given size and type, e.g. "jpg" or "png". */
    private static byte[] makeImage(int width, int height, int imageType, String format) throws IOException {
        BufferedImage img = new BufferedImage(width, height, imageType);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    /**
     * Sneaks a fake EXIF block (the place phones put GPS and camera info) into a JPEG, right after
     * its two opening bytes. This imitates a real phone photo that carries a hidden location.
     */
    private static byte[] withFakeExif(byte[] jpeg) {
        byte[] payload = "Exif\0\0FAKE-GPS-51.05N-114.07W".getBytes(StandardCharsets.ISO_8859_1);
        int segmentLength = payload.length + 2; // the length field counts itself
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg[0]); // 0xFF  start of image
        out.write(jpeg[1]); // 0xD8
        out.write(0xFF);    // APP1 marker: where EXIF lives
        out.write(0xE1);
        out.write(segmentLength >> 8);
        out.write(segmentLength & 0xFF);
        out.writeBytes(payload);
        out.write(jpeg, 2, jpeg.length - 2); // the rest of the original picture
        return out.toByteArray();
    }

    private static boolean contains(byte[] data, String text) {
        return new String(data, StandardCharsets.ISO_8859_1).contains(text);
    }

    private static BufferedImage decode(byte[] jpeg) throws IOException {
        return ImageIO.read(new ByteArrayInputStream(jpeg));
    }

    @Test
    void removesHiddenMetadata() throws IOException {
        byte[] withGps = withFakeExif(makeImage(200, 100, BufferedImage.TYPE_INT_RGB, "jpg"));
        assertTrue(contains(withGps, "Exif"), "test setup: the input should carry fake EXIF");
        assertTrue(contains(withGps, "FAKE-GPS"), "test setup: the input should carry the fake location");

        byte[] cleaned = ImageCleaner.clean(withGps);

        assertFalse(contains(cleaned, "Exif"), "EXIF block should be gone");
        assertFalse(contains(cleaned, "FAKE-GPS"), "the hidden location should be gone");
        assertNotNull(decode(cleaned), "the result should still be a readable picture");
    }

    @Test
    void outputIsAlwaysAJpeg() throws IOException {
        byte[] cleaned = ImageCleaner.clean(makeImage(50, 50, BufferedImage.TYPE_INT_ARGB, "png"));

        // Every JPEG file starts with the bytes FF D8
        assertEquals((byte) 0xFF, cleaned[0]);
        assertEquals((byte) 0xD8, cleaned[1]);
    }

    @Test
    void shrinksLargeImagesToTheMaximumSize() throws IOException {
        byte[] cleaned = ImageCleaner.clean(makeImage(4000, 3000, BufferedImage.TYPE_INT_RGB, "jpg"));

        BufferedImage result = decode(cleaned);
        assertEquals(1600, Math.max(result.getWidth(), result.getHeight()), "longest edge should be 1600");
        assertEquals(1200, Math.min(result.getWidth(), result.getHeight()), "shape (4:3) should be kept");
    }

    @Test
    void doesNotEnlargeSmallImages() throws IOException {
        byte[] cleaned = ImageCleaner.clean(makeImage(300, 200, BufferedImage.TYPE_INT_RGB, "jpg"));

        BufferedImage result = decode(cleaned);
        assertEquals(300, result.getWidth());
        assertEquals(200, result.getHeight());
    }

    @Test
    void rejectsFilesThatAreNotPictures() {
        byte[] notAnImage = "this is just text pretending to be a photo".getBytes(StandardCharsets.UTF_8);

        ApiException error = assertThrows(ApiException.class, () -> ImageCleaner.clean(notAnImage));
        assertEquals("bad_photo", error.getBody().getTitle());
    }

    @Test
    void rejectsEmptyUploads() {
        ApiException error = assertThrows(ApiException.class, () -> ImageCleaner.clean(new byte[0]));
        assertEquals("bad_photo", error.getBody().getTitle());
    }

    @Test
    void rejectsPicturesWithTooManyPixels() throws IOException {
        // 5100 x 5000 = 25.5 million pixels, just over the 25 million limit. A 1-bit image keeps the test file tiny.
        byte[] huge = makeImage(5100, 5000, BufferedImage.TYPE_BYTE_BINARY, "png");

        ApiException error = assertThrows(ApiException.class, () -> ImageCleaner.clean(huge));
        assertEquals("bad_photo", error.getBody().getTitle());
    }
}
