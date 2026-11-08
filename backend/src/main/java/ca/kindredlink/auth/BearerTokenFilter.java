package ca.kindredlink.auth;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.filter.OncePerRequestFilter;

import ca.kindredlink.common.ApiException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class BearerTokenFilter extends OncePerRequestFilter {
    private final AuthService service;
    private final JwtDecoder jwtDecoder;

    public BearerTokenFilter(AuthService service, JwtDecoder jwtDecoder) {
        this.service = service;
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.equals("/api/auth/register")
                || path.equals("/api/auth/login");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null) {
            String token = extractToken(header);
            Optional<AuthenticatedAccount> authenticated = service.authenticate(token);
            if (authenticated.isEmpty()) {
                try {
                    Jwt jwt = jwtDecoder.decode(token);
                    authenticated = Optional.of(service.authenticateAuth0(jwt));
                } catch (JwtException exception) {
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED,
                            "Invalid or expired authentication token");
                    return;
                } catch (ApiException exception) {
                    response.sendError(exception.getStatusCode().value(),
                            exception.getBody().getDetail());
                    return;
                }
            }
            var identity = new UsernamePasswordAuthenticationToken(
                    authenticated.get(), null,
                    List.of(new SimpleGrantedAuthority("ROLE_USER")));
            SecurityContextHolder.getContext().setAuthentication(identity);
        }
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    static String extractToken(String header) {
        if (header == null || !header.startsWith("Bearer ")) return "";
        String token = header.substring(7).trim();
        return token.length() <= 8192 ? token : "";
    }
}
