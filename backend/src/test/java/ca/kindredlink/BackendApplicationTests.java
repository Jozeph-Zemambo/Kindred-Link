package ca.kindredlink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.UUID;

import ca.kindredlink.auth.AuthService;
import ca.kindredlink.auth.AuthUser;
import ca.kindredlink.auth.AuthUserRepository;
import ca.kindredlink.common.ApiException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.beans.factory.annotation.Autowired;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class BackendApplicationTests {
	@Autowired
	private AuthService authService;

	@Test
	void contextLoads() {
	}

	@Test
	void provisionsAuth0UsersBySubject() {
		String suffix = UUID.randomUUID().toString();
		Jwt jwt = auth0Jwt("google-oauth2|" + suffix, "User+" + suffix + "@Example.com");

		var firstLogin = authService.authenticateAuth0(jwt);
		var secondLogin = authService.authenticateAuth0(jwt);

		assertEquals(firstLogin.id(), secondLogin.id());
	}

	@Test
	void doesNotLinkAuth0UsersToExistingEmailAccounts() {
		String suffix = UUID.randomUUID().toString();
		String email = "existing-" + suffix + "@example.com";
		authUserRepository.saveAndFlush(new AuthUser(email, "unused", Instant.now()));

		assertThrows(ApiException.class,
				() -> authService.authenticateAuth0(auth0Jwt("github|" + suffix, email)));
	}

	@Autowired
	private AuthUserRepository authUserRepository;

	private static Jwt auth0Jwt(String subject, String email) {
		return Jwt.withTokenValue("test-token")
				.header("alg", "RS256")
				.claim("sub", subject)
				.claim("https://kindredlink.example/email", email)
				.build();
	}
}
