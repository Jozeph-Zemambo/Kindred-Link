package ca.kindredlink.geo.geocoding;

/** One address lookup result, normalized for the frontend (provider-agnostic shape). */
public record GeocodingCandidate(String id, String displayName, double lat, double lng) {}
