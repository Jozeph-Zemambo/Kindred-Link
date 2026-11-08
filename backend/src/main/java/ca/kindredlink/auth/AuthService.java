package ca.kindredlink.auth;

import ca.kindredlink.auth.AuthDtos.AccountResponse;
import ca.kindredlink.auth.AuthDtos.LoginRequest;
import ca.kindredlink.auth.AuthDtos.RegisterRequest;
import ca.kindredlink.auth.AuthDtos.TokenResponse;
import ca.kindredlink.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final AuthUserRepository users;
    private final AuthSessionRepository sessions;
    private final PasswordEncoder passwords;
    private final Clock clock;
    private final Duration tokenLifetime;

    public AuthService(AuthUserRepository users, AuthSessionRepository sessions,
            PasswordEncoder passwords, Clock clock,
            @Value("${kindred.auth.token-hours:168}") long tokenHours) {
        this.users = users;
        this.sessions = sessions;
        this.passwords = passwords;
        this.clock = clock;
        if (tokenHours < 1 || tokenHours > 720) {
            throw new IllegalArgumentException("kindred.auth.token-hours must be between 1 and 720");
        }
        this.tokenLifetime = Duration.ofHours(tokenHours);
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "bad_password",
                    "Password exceeds the maximum supported byte length");
        }
        if (users.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "email_exists", "Email is already registered");
        }
        AuthUser user;
        try {
            user = users.saveAndFlush(new AuthUser(email,
                    passwords.encode(request.password()), clock.instant()));
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "email_exists", "Email is already registered");
        }
        return issueToken(user);
    }

    @Transactional
    public TokenResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Invalid email or password");
        }
        Optional<AuthUser> candidate = users.findByEmail(email);
        if (candidate.isEmpty() || !passwords.matches(request.password(), candidate.get().getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Invalid email or password");
        }
        return issueToken(candidate.get());
    }

    @Transactional(readOnly = true)
    public AccountResponse me(AuthenticatedAccount account) {
        AuthUser user = users.findById(account.id())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Account not found"));
        return new AccountResponse(user.getId(), user.getEmail(), user.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public Optional<AuthenticatedAccount> authenticate(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 256) return Optional.empty();
        Optional<AuthSession> match = sessions.findByTokenHash(hash(rawToken));
        if (match.isEmpty() || !clock.instant().isBefore(match.get().getExpiresAt())) return Optional.empty();
        Long id = match.get().getUserId();
        return users.existsById(id) ? Optional.of(new AuthenticatedAccount(id)) : Optional.empty();
    }

    @Transactional
    public void logout(String rawToken) {
        sessions.deleteByTokenHash(hash(rawToken));
    }

    private TokenResponse issueToken(AuthUser user) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = clock.instant().plus(tokenLifetime);
        sessions.save(new AuthSession(hash(raw), user.getId(), expires));
        return new TokenResponse(raw, "Bearer", expires);
    }

    private static String hash(String raw) {
        try {
            byte[] data = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(data);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Missing SHA-256", e);
        }
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
