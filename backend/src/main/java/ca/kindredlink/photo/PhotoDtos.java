package ca.kindredlink.photo;

/** Request/response shapes for /api/photos. */
public final class PhotoDtos {
    private PhotoDtos() {}

    /**
     * What the app gets back after uploading a photo: its id (to attach to a node later) and its
     * moderation status. A new photo is always PENDING.
     */
    public record PhotoUploadResponse(Long id, PhotoStatus status) {}
}
