package ca.kindredlink.photo;

import ca.kindredlink.common.DeviceId;
import ca.kindredlink.photo.PhotoDtos.PhotoSummary;
import ca.kindredlink.photo.PhotoDtos.PhotoUploadResponse;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/photos")
public class PhotoController {

    /** The secret header moderators send. Regular app users never send it. */
    static final String ADMIN_HEADER = "X-Admin-Key";

    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /**
     * Upload one photo (sent as multipart/form-data, in a part named "file"). Returns its id and
     * status PENDING. The size limit is set in application.yml (spring.servlet.multipart).
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE) // POST /api/photos
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoUploadResponse upload(
            @RequestPart("file") MultipartFile file, // the picture itself
            // required = false so our own clear "bad_device_id" error shows up, not a generic 400
            @RequestHeader(value = DeviceId.HEADER, required = false) String deviceId,
            @AuthenticationPrincipal Jwt principal) throws IOException {
        return service.upload(file.getBytes(), DeviceId.resolve(principal, deviceId));
    }

    /**
     * The picture itself, as a JPEG the app can show in a plain image view (no special headers
     * needed). Approved photos are public. Pending and rejected ones answer "not found" unless the
     * caller is a moderator (X-Admin-Key).
     */
    @GetMapping("/{id}") // GET /api/photos/12
    public ResponseEntity<byte[]> view(@PathVariable Long id,
            @RequestHeader(value = ADMIN_HEADER, required = false) String adminKey) {
        NodePhoto photo = service.view(id, adminKey);
        // Approved pictures never change, so phones may keep them for a day. Anything else must not be cached.
        CacheControl cache = photo.getStatus() == PhotoStatus.APPROVED
                ? CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic()
                : CacheControl.noStore();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).cacheControl(cache).body(photo.getData());
    }

    /** Moderator only: the queue of photos waiting for a decision, oldest first. */
    @GetMapping("/pending") // GET /api/photos/pending
    public List<PhotoSummary> pending(@RequestHeader(value = ADMIN_HEADER, required = false) String adminKey) {
        return service.pending(adminKey);
    }

    /** Moderator only: let everyone see this photo. */
    @PostMapping("/{id}/approve") // POST /api/photos/12/approve
    public PhotoUploadResponse approve(@PathVariable Long id,
            @RequestHeader(value = ADMIN_HEADER, required = false) String adminKey) {
        return service.approve(id, adminKey);
    }

    /** Moderator only: keep this photo hidden for good. */
    @PostMapping("/{id}/reject") // POST /api/photos/12/reject
    public PhotoUploadResponse reject(@PathVariable Long id,
            @RequestHeader(value = ADMIN_HEADER, required = false) String adminKey) {
        return service.reject(id, adminKey);
    }
}
