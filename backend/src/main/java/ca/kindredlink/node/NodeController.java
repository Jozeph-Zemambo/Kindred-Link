package ca.kindredlink.node;

import ca.kindredlink.security.AuthenticatedUser;
import ca.kindredlink.node.NodeDtos.ClaimRequest;
import ca.kindredlink.node.NodeDtos.ClaimResponse;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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

    /** Public map pins. Pass lat/lng to limit to a radius; mine=true requires login. */
    @GetMapping
    public List<NodePin> list(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "5000") double radius,
            @RequestParam(defaultValue = "false") boolean mine,
            @AuthenticationPrincipal Jwt jwt) {
        return service.listPins(lat, lng, radius, mine,
                mine ? AuthenticatedUser.require(jwt) : AuthenticatedUser.optional(jwt));
    }

    @GetMapping("/{id}")
    public NodeDetail get(@PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        return service.get(id, AuthenticatedUser.optional(jwt));
    }

    /** Start a brand-new chain. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NodeDetail create(@Valid @RequestBody CreateNodeRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        return service.createRoot(req, AuthenticatedUser.require(jwt));
    }

    /** Reserve one of the node's two slots. Returns the deadline to finish your act. */
    @PostMapping("/{id}/claim")                        // POST /api/nodes/5/claim
    @ResponseStatus(HttpStatus.CREATED)                // answer with 201
    public ClaimResponse claim(@PathVariable Long id,  // the 5 from the URL
            @Valid @RequestBody ClaimRequest req,      // JSON body with lat/lng, validated
            @AuthenticationPrincipal Jwt jwt) {  // authenticated Auth0 user
        return service.claim(id, req, AuthenticatedUser.require(jwt));  // all the rules live in the service
    }

    /** Post your act as the next link. You must have claimed this node first. */
    @PostMapping("/{id}/continue")
    @ResponseStatus(HttpStatus.CREATED)
    public NodeDetail continueChain(@PathVariable Long id, @Valid @RequestBody CreateNodeRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        return service.continueChain(id, req, AuthenticatedUser.require(jwt));
    }
}
