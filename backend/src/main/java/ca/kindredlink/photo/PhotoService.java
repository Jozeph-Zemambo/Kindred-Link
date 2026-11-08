package ca.kindredlink.photo;

import ca.kindredlink.KindredProperties;
import ca.kindredlink.common.ApiException;
import ca.kindredlink.photo.PhotoDtos.PhotoSummary;
import ca.kindredlink.photo.PhotoDtos.PhotoUploadResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The photo rules live here, like NodeService does for nodes.
 *
 * Who can see a photo: everyone, on every map, but only after a moderator has approved it.
 * Pending and rejected photos stay hidden from everyone except moderators.
 */
@Service
public class PhotoService {

    private final NodePhotoRepository photos;
    private final KindredProperties props;
    private final Clock clock; // the Clock bean, so tests can fake the time

    public PhotoService(NodePhotoRepository photos, KindredProperties props, Clock clock) {
        this.photos = photos;
        this.props = props;
        this.clock = clock;
    }

    /**
     * Clean the uploaded picture and store it as PENDING. Nobody else can see it until a moderator
     * approves it. Returns the photo's id so the app can attach it to a node.
     */
    @Transactional
    public PhotoUploadResponse upload(byte[] uploaded, String deviceId) {
        // Strips hidden data (GPS, camera info), shrinks big pictures, rejects anything that isn't an image.
        byte[] cleaned = ImageCleaner.clean(uploaded);

        // A new NodePhoto always starts out PENDING.
        NodePhoto photo = photos.save(new NodePhoto(deviceId, cleaned, clock.instant()));
        return new PhotoUploadResponse(photo.getId(), photo.getStatus());
    }

    // ---- Attaching a photo to a node (called by NodeService when a node is created or continued) ----

    /**
     * Link an uploaded photo to a node. Rules: the photo must exist, it must have been uploaded by
     * this same device (so nobody can attach someone else's picture), and it can only be used once.
     */
    @Transactional
    public void attach(Long photoId, Long nodeId, String deviceId) {
        NodePhoto photo = photos.findById(photoId).orElseThrow(() -> ApiException.notFound("Photo", photoId));
        if (!photo.getUploaderDeviceId().equals(deviceId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "not_your_photo", "You can only attach photos you uploaded");
        }
        if (photo.getNodeId() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "photo_used", "This photo is already attached to a node");
        }
        photo.setNodeId(nodeId); // the transaction saves this change when the method ends
    }

    // ---- What the maps and the node popup are allowed to show ----

    /**
     * The link to show for a node's photo, or null. Only APPROVED photos get a link, so pending and
     * rejected photos stay hidden from everyone.
     */
    @Transactional(readOnly = true)
    public String urlFor(Long nodeId) {
        return photos.findRefByNodeId(nodeId)
                .filter(ref -> ref.getStatus() == PhotoStatus.APPROVED)
                .map(ref -> "/api/photos/" + ref.getId())
                .orElse(null);
    }

    /** Of these nodes, the ones with an APPROVED photo (for the hasPhoto flag). One query for the whole list. */
    @Transactional(readOnly = true)
    public Set<Long> nodesWithApprovedPhoto(Collection<Long> nodeIds) {
        if (nodeIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(photos.findNodeIdsByStatus(nodeIds, PhotoStatus.APPROVED));
    }

    /**
     * The photo itself. Anyone can see an APPROVED photo. A PENDING or REJECTED one can only be seen
     * by a moderator (valid admin key). Everyone else gets "not found", so they can't even tell it exists.
     */
    @Transactional(readOnly = true)
    public NodePhoto view(Long id, String adminKey) {
        NodePhoto photo = photos.findById(id).orElseThrow(() -> ApiException.notFound("Photo", id));
        if (photo.getStatus() == PhotoStatus.APPROVED || isModerator(adminKey)) {
            return photo;
        }
        throw ApiException.notFound("Photo", id);
    }

    // ---- Moderation (needs the secret admin key) ----

    /** Photos waiting for a decision, oldest first. */
    @Transactional(readOnly = true)
    public List<PhotoSummary> pending(String adminKey) {
        requireModerator(adminKey);
        return photos.findQueue(PhotoStatus.PENDING).stream()
                .map(p -> new PhotoSummary(p.getId(), p.getNodeId(), p.getCreatedAt()))
                .toList();
    }

    @Transactional
    public PhotoUploadResponse approve(Long id, String adminKey) {
        return decide(id, adminKey, PhotoStatus.APPROVED);
    }

    @Transactional
    public PhotoUploadResponse reject(Long id, String adminKey) {
        return decide(id, adminKey, PhotoStatus.REJECTED);
    }

    private PhotoUploadResponse decide(Long id, String adminKey, PhotoStatus decision) {
        requireModerator(adminKey);
        NodePhoto photo = photos.findById(id).orElseThrow(() -> ApiException.notFound("Photo", id));
        photo.setStatus(decision);
        return new PhotoUploadResponse(photo.getId(), photo.getStatus());
    }

    private void requireModerator(String adminKey) {
        if (!isModerator(adminKey)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "not_moderator", "A valid X-Admin-Key is required");
        }
    }

    /**
     * True only if a key is configured AND the caller's key matches it. A blank configured key
     * means moderation is switched off, so nobody counts as a moderator. The comparison takes the
     * same time whether the key is nearly right or totally wrong, so it can't be guessed bit by bit.
     */
    private boolean isModerator(String adminKey) {
        String configured = props.moderation().adminKey();
        if (configured == null || configured.isBlank() || adminKey == null) {
            return false;
        }
        return MessageDigest.isEqual(
                configured.getBytes(StandardCharsets.UTF_8), adminKey.getBytes(StandardCharsets.UTF_8));
    }
}
