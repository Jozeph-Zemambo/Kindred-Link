package ca.kindredlink.geo.geocoding;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Where address lookups go. Defaults target the public Nominatim service - keep it
 * polite (identifying user agent, <=1 request/second, cached results) or point
 * GEOCODING_BASE_URL / GEOCODING_USER_AGENT at your own provider for production.
 */
@ConfigurationProperties(prefix = "kindred.geocoding")
public record GeocodingProperties(String baseUrl, String userAgent) {}
