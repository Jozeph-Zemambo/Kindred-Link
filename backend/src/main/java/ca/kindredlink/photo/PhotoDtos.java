package ca.kindredlink.photo;

import java.time.Instant;

/** Request/response shapes for /api/photos. */
public final class PhotoDtos {
    private PhotoDtos() {}

    /**
     * What the app gets back after uploading a photo (and what a moderator gets after approving or
     * rejecting one): its id and its moderation status. A new photo is always PENDING.
     */
    public record PhotoUploadResponse(Long id, PhotoStatus status) {}

    /** One line of the moderator's queue: a photo waiting for a decision. Fetch the picture with GET /api/photos/{id}. */
    public record PhotoSummary(Long id, Long nodeId, Instant createdAt) {}
}
