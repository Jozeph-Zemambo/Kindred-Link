package ca.kindredlink.photo;

/**
 * Screens a cleaned image before it is stored. True means the photo may skip the manual
 * moderation queue; false (or any provider problem) means it stays PENDING for a moderator.
 */
public interface PhotoSafetyChecker {

    /** Checks already-CLEANED image bytes (post-ImageCleaner: no EXIF, re-encoded JPEG). */
    boolean isSafe(byte[] cleanedImage);
}
