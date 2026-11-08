package ca.kindredlink.security;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/** Validates Auth0-issued JWT access tokens; never trusts caller-provided identity headers. */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // Stateless bearer-token API, not cookie authentication.
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/me").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                // Moderator endpoints still require the existing server-side X-Admin-Key check.
                .requestMatchers(HttpMethod.POST, "/api/photos/*/approve", "/api/photos/*/reject").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/nodes", "/api/nodes/*/claim",
                    "/api/nodes/*/continue", "/api/businesses/*/checkin", "/api/photos").authenticated()
                .requestMatchers(HttpMethod.GET, "/actuator/health", "/docs/**", "/v3/api-docs/**").permitAll()
                .anyRequest().denyAll()
            )
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(@Value("${auth0.domain:}") String domain,
                          @Value("${auth0.audience:}") String audience) {
        // Fail closed: prevent accidentally running an unprotected deployment.
        if (domain.isBlank() || audience.isBlank() || domain.contains("://") || domain.contains("/")) {
            throw new IllegalStateException("Set AUTH0_DOMAIN (hostname only) and AUTH0_AUDIENCE (API Identifier)");
        }
        String issuer = "https://" + domain + "/";
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(issuer + ".well-known/jwks.json").build();
        OAuth2TokenValidator<Jwt> issuerAndTime = JwtValidators.createDefaultWithIssuer(issuer);
        OAuth2TokenValidator<Jwt> correctAudience = jwt ->
            jwt.getAudience() != null && jwt.getAudience().contains(audience)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Wrong JWT audience", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(List.of(issuerAndTime, correctAudience)));
        return decoder;
    }
}
