package ca.kindredlink.geo.geocoding;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import ca.kindredlink.common.ApiException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class NominatimClientTest {

    private static final String SAMPLE = """
            [{"place_id":123456,"display_name":"UCalgary, 2500 University Dr NW, Calgary",
              "lat":"51.0773","lon":"-114.1307","licence":"ODbL"}]
            """;

    private MockRestServiceServer server;
    private NominatimClient client;

    @BeforeEach
    void setup() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        GeocodingProperties props = new GeocodingProperties("https://nominatim.test", "KindredLink-Test/1.0");
        client = new NominatimClient(props, builder.build());
    }

    private void expectSearch(String body) {
        server.expect(requestTo(allOf(
                        containsString("https://nominatim.test/search"),
                        containsString("format=jsonv2"),
                        containsString("limit=5"))))
                .andExpect(header(HttpHeaders.USER_AGENT, "KindredLink-Test/1.0"))
                .andExpect(header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }

    @Test
    void mapsResultsAndEncodesQuerySafely() {
        server.expect(requestTo(allOf(
                        containsString("https://nominatim.test/search"),
                        containsString("format=jsonv2"),
                        containsString("limit=5"))))
                .andExpect(header(HttpHeaders.USER_AGENT, "KindredLink-Test/1.0"))
                .andExpect(header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE))
                // Encoded form proves &/+/, stay inside q instead of splitting params.
                .andExpect(queryParam("q", "A%20%26%20B%20%2B%20Cafe%2C%20Calgary"))
                .andRespond(withSuccess(SAMPLE, MediaType.APPLICATION_JSON));

        List<GeocodingCandidate> out = client.search("A & B + Cafe, Calgary");

        assertEquals(1, out.size());
        GeocodingCandidate c = out.get(0);
        assertEquals("123456", c.id());
        assertEquals("UCalgary, 2500 University Dr NW, Calgary", c.displayName());
        assertEquals(51.0773, c.lat(), 1e-9);
        assertEquals(-114.1307, c.lng(), 1e-9);
    }

    @Test
    void emptyArrayIsValidEmptyResult() {
        expectSearch("[]");
        assertTrue(client.search("no such place").isEmpty());
        server.verify();
    }

    @Test
    void malformedPayloadsBecomeUnavailable() {
        String[] bad = {
                "[{\"place_id\":\"\",\"display_name\":\"x\",\"lat\":\"1\",\"lon\":\"2\"}]",
                "[{\"place_id\":\"1\",\"display_name\":\"x\",\"lat\":\"abc\",\"lon\":\"2\"}]",
                "[{\"place_id\":\"1\",\"display_name\":\"x\",\"lat\":\"91\",\"lon\":\"2\"}]",
                "[{\"place_id\":\"1\",\"display_name\":\"x\",\"lat\":\"NaN\",\"lon\":\"2\"}]",
                "[{\"place_id\":\"1\",\"lat\":\"1\",\"lon\":\"2\"}]",
                "not json",
                "",
                oversized()};
        // Expectations must all be declared before the first request is made.
        for (String payload : bad) {
            server.expect(requestTo(containsString("/search")))
                    .andRespond(withSuccess(payload, MediaType.APPLICATION_JSON));
        }
        for (String payload : bad) {
            ApiException e = assertThrows(ApiException.class, () -> client.search("q"));
            assertEquals("geocoding_unavailable", e.getBody().getTitle(), "payload: " + payload);
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, e.getStatusCode());
        }
    }

    /** Six well-formed entries - a provider ignoring limit=5 is still malformed for us. */
    private static String oversized() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 6; i++) {
            sb.append(i == 0 ? "" : ",")
              .append("{\"place_id\":\"").append(i)
              .append("\",\"display_name\":\"x\",\"lat\":\"1\",\"lon\":\"2\"}");
        }
        return sb.append("]").toString();
    }

    @Test
    void upstreamErrorsBecomeUnavailable() {
        HttpStatus[] statuses = {HttpStatus.TOO_MANY_REQUESTS,
                HttpStatus.INTERNAL_SERVER_ERROR, HttpStatus.BAD_GATEWAY};
        for (HttpStatus upstream : statuses) {
            server.expect(requestTo(containsString("/search")))
                    .andRespond(withStatus(upstream));
        }
        for (HttpStatus upstream : statuses) {
            ApiException e = assertThrows(ApiException.class, () -> client.search("q"));
            assertEquals("geocoding_unavailable", e.getBody().getTitle());
        }
    }
}
