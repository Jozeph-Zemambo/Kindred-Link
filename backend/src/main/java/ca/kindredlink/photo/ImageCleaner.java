package ca.kindredlink.photo;

import ca.kindredlink.common.ApiException;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.http.HttpStatus;

/**
 * Turns whatever the phone uploaded into a safe, small, plain JPEG.
 *
 * Why: photos from phones carry hidden data (EXIF) such as the exact GPS spot, the time and the
 * camera model. That would undo our privacy rule of never storing exact locations. We drop it by
 * decoding the picture to raw pixels and writing a NEW file from those pixels only. Nothing else
 * is copied across, so the hidden data can't come along.
 */
public final class ImageCleaner {

    /** The longest edge of the stored picture, in pixels. Bigger uploads are shrunk to this. */
    static final int MAX_SIDE = 1600;

    /** Refuse pictures with more pixels than this. Decoding a giant one could crash the server. */
    static final long MAX_PIXELS = 25_000_000L;

    private ImageCleaner() {}

    /** Returns a brand-new JPEG with no metadata, or throws a 400 "bad_photo" error. */
    public static byte[] clean(byte[] uploaded) {
        if (uploaded == null || uploaded.length == 0) {
            throw badPhoto("The photo is empty");
        }
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(uploaded))) {
            // Find a decoder for this file type. None found means it isn't a picture at all.
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw badPhoto("That file isn't a picture we can read");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in);

                // Check the size BEFORE decoding. Reading just the dimensions is cheap and safe.
                long width = reader.getWidth(0);
                long height = reader.getHeight(0);
                if (width * height > MAX_PIXELS) {
                    throw badPhoto("That picture is too large");
                }

                BufferedImage original = reader.read(0);
                return toCleanJpeg(original);
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            // A corrupt or unsupported file (or a type like CMYK that Java can't decode).
            throw badPhoto("That picture can't be read");
        }
    }

    /** Shrinks the picture if needed, then writes it out as a fresh JPEG. */
    private static byte[] toCleanJpeg(BufferedImage original) throws IOException {
        int w = original.getWidth();
        int h = original.getHeight();

        // Scale down so the longest edge is at most MAX_SIDE. Never scale UP (scale is capped at 1).
        double scale = Math.min(1.0, (double) MAX_SIDE / Math.max(w, h));
        int newW = Math.max(1, (int) Math.round(w * scale));
        int newH = Math.max(1, (int) Math.round(h * scale));

        // Draw onto a plain RGB canvas. JPEG has no transparency, so a transparent PNG gets a white background.
        BufferedImage canvas = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = canvas.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, newW, newH);
            g.drawImage(original, 0, 0, newW, newH, null);
        } finally {
            g.dispose();
        }

        // Writing from the canvas (pixels only) is what leaves the hidden metadata behind.
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!ImageIO.write(canvas, "jpg", out)) {
            throw new IOException("No JPEG writer available");
        }
        return out.toByteArray();
    }

    private static ApiException badPhoto(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "bad_photo", message);
    }
}
