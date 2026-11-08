package ca.kindredlink.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

/**
 * Stable, non-guessable account key for existing device-id database fields.
 * Derived exclusively from a verified JWT 'sub', never from X-Device-Id or email.
 * Hash keeps the existing VARCHAR(255) indexes and avoids exposing raw Auth0 subjects.
 */
public final class AuthenticatedUser {
    private AuthenticatedUser() {}

    public static String optional(Jwt jwt) {
        return jwt == null ? null : fromSubject(jwt.getSubject());
    }

    public static String require(Jwt jwt) {
        if (jwt == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in with Auth0 to continue");
        }
        return fromSubject(jwt.getSubject());
    }

    static String fromSubject(String subject) {
        if (subject == null || subject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing Auth0 subject");
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(subject.getBytes(StandardCharsets.UTF_8));
            return "auth0-" + Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
