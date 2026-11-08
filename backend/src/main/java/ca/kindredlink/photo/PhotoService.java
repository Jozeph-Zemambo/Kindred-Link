package ca.kindredlink.photo;

import ca.kindredlink.photo.PhotoDtos.PhotoUploadResponse;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The photo rules live here, like NodeService does for nodes. */
@Service
public class PhotoService {

    private final NodePhotoRepository photos;
    private final Clock clock; // the Clock bean, so tests can fake the time

    public PhotoService(NodePhotoRepository photos, Clock clock) {
        this.photos = photos;
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
}
