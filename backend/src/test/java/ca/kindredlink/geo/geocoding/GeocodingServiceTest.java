package ca.kindredlink.geo.geocoding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ca.kindredlink.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class GeocodingServiceTest {

    private final AtomicLong now = new AtomicLong(1_000_000);
    private GeocodingClient client;
    private GeocodingService service;

    private final GeocodingCandidate cand =
            new GeocodingCandidate("p1", "UCalgary, Calgary, Alberta", 51.0773, -114.1307);

    @BeforeEach
    void setup() {
        client = mock(GeocodingClient.class);
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenAnswer(inv -> now.get());
        service = new GeocodingService(client, clock);
        when(client.search(anyString())).thenReturn(List.of(cand));
    }

    private String titleOf(ApiException e) {
        return e.getBody().getTitle();
    }

    @Test
    void firstQueryCallsProviderOnce() {
        assertEquals(List.of(cand), service.search("UCalgary"));
        verify(client).search("UCalgary");
    }

    @Test
    void equivalentQueryIsCachedBeforeRateCheck() {
        service.search("UCalgary");
        assertEquals(List.of(cand), service.search("  ucalgary    "));
        verify(client, times(1)).search(anyString());
    }

    @Test
    void differentQueryInsideWindowIsRateLimited() {
        service.search("alpha");
        ApiException e = assertThrows(ApiException.class, () -> service.search("beta"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatusCode());
        assertEquals("geocoding_rate_limited", titleOf(e));
        verify(client, times(1)).search(anyString());
    }

    @Test
    void nextQueryAllowedAfterInterval() {
        service.search("alpha");
        now.addAndGet(1_099);
        assertThrows(ApiException.class, () -> service.search("beta"));
        now.addAndGet(1);
        assertEquals(List.of(cand), service.search("beta"));
        verify(client, times(2)).search(anyString());
    }

    @Test
    void failureConsumesRateAndIsNotCached() {
        ApiException boom = new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "geocoding_unavailable", "down");
        when(client.search("alpha")).thenThrow(boom).thenReturn(List.of(cand));

        ApiException e1 = assertThrows(ApiException.class, () -> service.search("alpha"));
        assertEquals("geocoding_unavailable", titleOf(e1));

        ApiException e2 = assertThrows(ApiException.class, () -> service.search("alpha"));
        assertEquals("geocoding_rate_limited", titleOf(e2));
        verify(client, times(1)).search("alpha");

        now.addAndGet(1_100);
        assertEquals(List.of(cand), service.search("alpha"));
        verify(client, times(2)).search("alpha");
    }

    @Test
    void emptyResultIsCached() {
        when(client.search("nowhere")).thenReturn(List.of());
        assertEquals(List.of(), service.search("nowhere"));
        assertEquals(List.of(), service.search("NOWHERE"));
        verify(client, times(1)).search("nowhere");
    }

    @Test
    void cacheExpiresAfter24Hours() {
        service.search("alpha");
        now.addAndGet(Duration.ofHours(24).toMillis() - 1);
        assertEquals(List.of(cand), service.search("ALPHA"));
        verify(client, times(1)).search(anyString());
        now.addAndGet(2);
        service.search("alpha");
        verify(client, times(2)).search("alpha");
    }

    @Test
    void invalidQueriesNeverReachProvider() {
        for (String bad : new String[] {null, "", "   ", "ab", "x".repeat(201)}) {
            ApiException e = assertThrows(ApiException.class, () -> service.search(bad));
            assertEquals("invalid_address", titleOf(e));
        }
        assertEquals(List.of(cand), service.search("x".repeat(200)));
        verify(client, times(1)).search(anyString());
    }

    @Test
    void cacheEvictsOldestBeyondBound() {
        for (int i = 0; i < 129; i++) {
            service.search("query-" + i);
            now.addAndGet(1_100);
        }
        verify(client, times(129)).search(anyString());
        service.search("query-0"); // evicted -> upstream again
        verify(client, times(2)).search("query-0");
    }
}
