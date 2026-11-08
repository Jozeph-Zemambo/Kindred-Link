package ca.kindredlink.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ca.kindredlink.auth.AuthDtos.AccountResponse;
import ca.kindredlink.auth.AuthDtos.LoginRequest;
import ca.kindredlink.auth.AuthDtos.RegisterRequest;
import ca.kindredlink.auth.AuthDtos.TokenResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;

    public AuthController(AuthService service) { this.service = service; }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenResponse register(@Valid @RequestBody RegisterRequest request) {
        return service.register(request);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request);
    }

    @GetMapping("/me")
    public AccountResponse me(@AuthenticationPrincipal AuthenticatedAccount account) {
        return service.me(account);
    }

    
@PostMapping("/logout")
@ResponseStatus(HttpStatus.NO_CONTENT)
@SecurityRequirement(name = "bearerAuth")
public void logout(HttpServletRequest request) {
    String authorization =
            request.getHeader(HttpHeaders.AUTHORIZATION);

    service.logout(
            BearerTokenFilter.extractToken(authorization));
}

}
