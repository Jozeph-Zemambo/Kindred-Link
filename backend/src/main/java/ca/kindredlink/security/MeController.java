package ca.kindredlink.security;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class MeController {
    /** Basic identity check: never return a raw token or unnecessary personal details. */
    @GetMapping
    public Map<String, String> me(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("userId", AuthenticatedUser.require(jwt));
    }
}
