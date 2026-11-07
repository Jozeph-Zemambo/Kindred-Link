package ca.kindredlink.node;

import ca.kindredlink.common.DeviceId;
import ca.kindredlink.node.NodeDtos.CreateNodeRequest;
import ca.kindredlink.node.NodeDtos.NodeDetail;
import ca.kindredlink.node.NodeDtos.NodePin;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/nodes")
public class NodeController {

    private final NodeService service;

    public NodeController(NodeService service) {
        this.service = service;
    }

    /** Public map pins. Pass lat/lng to limit to a radius; pass mine=true for "my acts". */
    @GetMapping
    public List<NodePin> list(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "5000") double radius,
            @RequestParam(defaultValue = "false") boolean mine,
            @RequestHeader(value = DeviceId.HEADER, required = false) String deviceId) {
        return service.listPins(lat, lng, radius, mine, deviceId);
    }

    @GetMapping("/{id}")
    public NodeDetail get(@PathVariable Long id,
            @RequestHeader(value = DeviceId.HEADER, required = false) String deviceId) {
        return service.get(id, deviceId);
    }

    /** Start a brand-new chain. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NodeDetail create(@Valid @RequestBody CreateNodeRequest req,
            @RequestHeader(DeviceId.HEADER) String deviceId) {
        return service.createRoot(req, deviceId);
    }

    @PostMapping("/{id}/continue")
    @ResponseStatus(HttpStatus.CREATED)
    public NodeDetail continueChain(@PathVariable Long id, @Valid @RequestBody CreateNodeRequest req,
            @RequestHeader(DeviceId.HEADER) String deviceId) {
        return service.continueChain(id, req, deviceId);
    }
}
