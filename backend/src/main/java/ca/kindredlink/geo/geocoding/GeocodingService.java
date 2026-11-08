package ca.kindredlink.geo.geocoding;

import ca.kindredlink.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Polite wrapper over the provider client: validates and normalizes queries, caches
 * results 24 h (bounded, in-memory - cleared on restart), and enforces the public
 * Nominatim rule of at most one upstream call per ~1.1 s per process. Demo-grade:
 * multiple backend instances would each rate-limit independently.
 */
@Service
public class GeocodingService {

    static final int MIN_QUERY_LEN = 3;
    static final int MAX_QUERY_LEN = 200;
    static final long MIN_INTERVAL_MS = 1_100;
    static final Duration CACHE_TTL = Duration.ofHours(24);
    static final int CACHE_MAX = 128;

    private final GeocodingClient client;
    private final Clock clock;

    /** access-order LRU: bound the size, expired entries dropped on read. */
    private final Map<String, CacheEntry> cache = new LinkedHashMap<>(CACHE_MAX, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, CacheEntry> eldest) {
            return size() > CACHE_MAX;
        }
    };

    private Long lastAttemptMillis;

    public GeocodingService(GeocodingClient client, Clock clock) {
        this.client = client;
        this.clock = clock;
    }

    /** Serialized so the rate cap and cache stay correct under concurrent requests. */
    public synchronized List<GeocodingCandidate> search(String rawQuery) {
        String q = normalize(rawQuery);
        if (q.length() < MIN_QUERY_LEN || q.length() > MAX_QUERY_LEN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_address",
                    "Address must be " + MIN_QUERY_LEN + "-" + MAX_QUERY_LEN + " characters");
        }
        String key = q.toLowerCase(Locale.ROOT);
        long now = clock.millis();
        CacheEntry hit = cache.get(key);
        if (hit != null) {
            if (now < hit.expiresAtMillis()) {
                return hit.results();
            }
            cache.remove(key);
        }
        if (lastAttemptMillis != null && now - lastAttemptMillis < MIN_INTERVAL_MS) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "geocoding_rate_limited",
                    "Address lookup is rate limited - try again in a moment");
        }
        lastAttemptMillis = now;
        List<GeocodingCandidate> fetched = client.search(q);
        List<GeocodingCandidate> results = fetched == null ? List.of() : List.copyOf(fetched);
        cache.put(key, new CacheEntry(results, now + CACHE_TTL.toMillis()));
        return results;
    }

    private static String normalize(String raw) {
        return raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
    }

    private record CacheEntry(List<GeocodingCandidate> results, long expiresAtMillis) {}
}
