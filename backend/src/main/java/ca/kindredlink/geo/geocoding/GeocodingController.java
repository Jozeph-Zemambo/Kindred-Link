package ca.kindredlink.geo.geocoding;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Generic address lookup - used by the business lab now, reusable for kindness nodes later. */
@RestController
@RequestMapping("/api/geocoding")
public class GeocodingController {

    private final GeocodingService service;

    public GeocodingController(GeocodingService service) {
        this.service = service;
    }

    @GetMapping("/search")
    public List<GeocodingCandidate> search(@RequestParam String q) {
        return service.search(q);
    }
}
