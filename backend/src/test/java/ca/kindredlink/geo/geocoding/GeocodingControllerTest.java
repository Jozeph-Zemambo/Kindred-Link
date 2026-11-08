package ca.kindredlink.geo.geocoding;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.kindredlink.common.ApiException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GeocodingControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private GeocodingService geocoding;

    private final GeocodingCandidate cand =
            new GeocodingCandidate("p1", "UCalgary, Calgary, Alberta", 51.0773, -114.1307);

    @Test
    void returnsCandidateShape() throws Exception {
        when(geocoding.search("UCalgary")).thenReturn(List.of(cand));

        mvc.perform(get("/api/geocoding/search").param("q", "UCalgary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("p1"))
                .andExpect(jsonPath("$[0].displayName").value("UCalgary, Calgary, Alberta"))
                .andExpect(jsonPath("$[0].lat").value(51.0773))
                .andExpect(jsonPath("$[0].lng").value(-114.1307));
    }

    @Test
    void missingQueryIs400() throws Exception {
        mvc.perform(get("/api/geocoding/search"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invalidAddressesSurface400WithTitle() throws Exception {
        when(geocoding.search(ArgumentMatchers.anyString()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "invalid_address", "bad"));

        mvc.perform(get("/api/geocoding/search").param("q", "  "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("invalid_address"));

        mvc.perform(get("/api/geocoding/search").param("q", "x".repeat(201)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("invalid_address"));
    }

    @Test
    void rateLimitSurfaces429WithTitle() throws Exception {
        when(geocoding.search(ArgumentMatchers.anyString()))
                .thenThrow(new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                        "geocoding_rate_limited", "slow down"));

        mvc.perform(get("/api/geocoding/search").param("q", "Calgary"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.title").value("geocoding_rate_limited"));
    }

    @Test
    void providerFailureSurfaces503WithTitle() throws Exception {
        when(geocoding.search(ArgumentMatchers.anyString()))
                .thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                        "geocoding_unavailable", "down"));

        mvc.perform(get("/api/geocoding/search").param("q", "Calgary"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.title").value("geocoding_unavailable"));
    }
}
