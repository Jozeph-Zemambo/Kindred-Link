package ca.kindredlink.photo;

import ca.kindredlink.common.DeviceId;
import ca.kindredlink.photo.PhotoDtos.PhotoUploadResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
            @RequestHeader(value = DeviceId.HEADER, required = false) String deviceId) throws IOException {
        return service.upload(file.getBytes(), DeviceId.require(deviceId));
    }
}
