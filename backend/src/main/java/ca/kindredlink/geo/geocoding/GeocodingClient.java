package ca.kindredlink.geo.geocoding;

import java.util.List;

/** Provider call, isolated so services and tests never touch the network directly. */
public interface GeocodingClient {

    List<GeocodingCandidate> search(String normalizedQuery);
}
