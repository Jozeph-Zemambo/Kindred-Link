package ca.kindredlink.auth;

import java.time.Instant;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
            @Email @NotBlank @Size(max = 254) String email,
            @NotBlank @Size(min = 12, max = 72) String password) {}

    public record LoginRequest(
            @Email @NotBlank @Size(max = 254) String email,
            @NotBlank String password) {}

    public record TokenResponse(String accessToken, String tokenType, Instant expiresAt) {}

    public record AccountResponse(Long id, String email, Instant createdAt) {}
}
