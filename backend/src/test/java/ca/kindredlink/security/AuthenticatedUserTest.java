package ca.kindredlink.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class AuthenticatedUserTest {
    @Test
    void stableAccountIdFitsExistingDatabaseColumns() {
        String id = AuthenticatedUser.fromSubject("google-oauth2|12345");
        assertEquals(id, AuthenticatedUser.fromSubject("google-oauth2|12345"));
        assertTrue(id.matches("auth0-[A-Za-z0-9_-]{43}"));
        assertNotEquals(id, AuthenticatedUser.fromSubject("facebook|12345"));
    }

    @Test
    void noAnonymousAccountCanBeCreated() {
        assertThrows(ResponseStatusException.class, () -> AuthenticatedUser.fromSubject(""));
        assertThrows(ResponseStatusException.class, () -> AuthenticatedUser.require(null));
    }
}
