package ca.kindredlink.business;

import ca.kindredlink.business.BusinessDtos.BusinessHub;
import ca.kindredlink.business.BusinessDtos.CheckinRequest;
import ca.kindredlink.business.BusinessDtos.CheckinResult;
import ca.kindredlink.common.DeviceId;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/businesses")
public class BusinessController {

    private final BusinessService service;

    public BusinessController(BusinessService service) {
        this.service = service;
    }

    @GetMapping
    public List<BusinessHub> list() {
        return service.list();
    }

    @PostMapping("/{id}/checkin")
    @ResponseStatus(HttpStatus.CREATED)
    public CheckinResult checkin(@PathVariable Long id, @Valid @RequestBody CheckinRequest req,
            @RequestHeader(value = DeviceId.HEADER, required = false) String deviceId,
            @AuthenticationPrincipal Jwt principal) {
        return service.checkin(id, req, DeviceId.resolve(principal, deviceId));
    }
}
