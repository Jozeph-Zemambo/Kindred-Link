package ca.kindredlink.geo.geocoding;

import ca.kindredlink.common.ApiException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Calls the configured Nominatim-compatible provider once per request - no retries.
 * Any transport/HTTP/malformed-payload problem surfaces as one generic 503 so raw
 * provider details never leak to callers.
 */
@Component
public class NominatimClient implements GeocodingClient {

    private static final int CONNECT_TIMEOUT_MS = 3_000;
    private static final int READ_TIMEOUT_MS = 5_000;
    private static final int LIMIT = 5;

    private final RestClient client;
    private final GeocodingProperties props;

    @Autowired
    public NominatimClient(GeocodingProperties props) {
        this(props, buildClient(props));
    }

    NominatimClient(GeocodingProperties props, RestClient client) {
        this.props = props;
        this.client = client;
    }

    private static RestClient buildClient(GeocodingProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        return RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public List<GeocodingCandidate> search(String normalizedQuery) {
        NominatimResult[] body;
        try {
            ResponseEntity<NominatimResult[]> resp = client.get()
                    // Template expansion percent-encodes q, so spaces/&/+ can't inject params.
                    .uri(props.baseUrl() + "/search?format=jsonv2&limit=" + LIMIT + "&addressdetails=0&q={q}",
                            normalizedQuery)
                    .header(HttpHeaders.USER_AGENT, props.userAgent())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .toEntity(NominatimResult[].class);
            body = resp.getBody();
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw unavailable();
        }
        // A provider ignoring our limit yields more than LIMIT - treat as malformed.
        if (body == null || body.length > LIMIT) {
            throw unavailable();
        }
        List<GeocodingCandidate> out = new ArrayList<>(body.length);
        for (NominatimResult r : body) {
            out.add(map(r));
        }
        return List.copyOf(out);
    }

    private GeocodingCandidate map(NominatimResult r) {
        if (r == null || isBlank(r.place_id()) || isBlank(r.display_name())) {
            throw unavailable();
        }
        double lat, lng;
        try {
            lat = Double.parseDouble(r.lat());
            lng = Double.parseDouble(r.lon());
        } catch (NumberFormatException | NullPointerException e) {
            throw unavailable();
        }
        if (!Double.isFinite(lat) || !Double.isFinite(lng)
                || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw unavailable();
        }
        return new GeocodingCandidate(r.place_id(), r.display_name(), lat, lng);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "geocoding_unavailable",
                "Address lookup is temporarily unavailable");
    }

    private record NominatimResult(String place_id, String display_name, String lat, String lon) {}
}
