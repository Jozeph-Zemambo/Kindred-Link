package ca.kindredlink.photo;

import java.util.Base64;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * One synchronous SafeSearch call per upload (bounded ~8s worst case; acceptable for the demo -
 * a real deployment would move this off the request path). Fail-closed everywhere: no key, any
 * transport/HTTP/malformed-payload problem, or any non-minimal likelihood means PENDING, never a
 * rejection and never an approval. The decision itself lives in PhotoSafetyPolicy.
 *
 * The key travels in the X-Goog-Api-Key header, never the URL, so it can't end up in access or
 * error logs.
 */
@Component
public class GoogleVisionSafetyChecker implements PhotoSafetyChecker {

    private static final Logger log = LoggerFactory.getLogger(GoogleVisionSafetyChecker.class);

    private static final String ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";
    private static final int CONNECT_TIMEOUT_MS = 3_000;
    private static final int READ_TIMEOUT_MS = 5_000;

    private final VisionModerationProperties props;
    private final RestClient client;

    @Autowired
    public GoogleVisionSafetyChecker(VisionModerationProperties props) {
        this(props, buildClient());
    }

    GoogleVisionSafetyChecker(VisionModerationProperties props, RestClient client) {
        this.props = props;
        this.client = client;
    }

    private static RestClient buildClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        return RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public boolean isSafe(byte[] cleanedImage) {
        String key = props.apiKey();
        if (key == null || key.isBlank()) {
            return false; // screening is off - no request, everything stays manual
        }
        try {
            AnnotateResponse body = client.post()
                    .uri(ENDPOINT)
                    .header("X-Goog-Api-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(requestBody(cleanedImage))
                    .retrieve()
                    .body(AnnotateResponse.class);
            return decide(body);
        } catch (Exception e) {
            // Deliberately generic: no exception text, response body, key or image bytes.
            log.warn("Photo safety screening failed; leaving the photo pending for manual review");
            return false;
        }
    }

    /** True only for a single clean result the policy approves; anything unexpected is unsafe. */
    private static boolean decide(AnnotateResponse body) {
        if (body == null || body.responses() == null || body.responses().size() != 1) {
            return false;
        }
        AnnotateResult result = body.responses().getFirst();
        if (result == null || result.error() != null || result.safeSearchAnnotation() == null) {
            return false;
        }
        SafeSearchAnnotation annotation = result.safeSearchAnnotation();
        return PhotoSafetyPolicy.canAutoApprove(annotation.adult(), annotation.violence(), annotation.racy());
    }

    private static AnnotateRequest requestBody(byte[] image) {
        String base64 = Base64.getEncoder().encodeToString(image);
        return new AnnotateRequest(
                List.of(new AnnotateItem(new ImageContent(base64), List.of(new Feature("SAFE_SEARCH_DETECTION")))));
    }

    // ---- request wire shape: {"requests":[{"image":{"content":"..."},"features":[{"type":"..."}]}]} ----

    private record AnnotateRequest(List<AnnotateItem> requests) {}

    private record AnnotateItem(ImageContent image, List<Feature> features) {}

    private record ImageContent(String content) {}

    private record Feature(String type) {}

    // ---- response wire shape: {"responses":[{"safeSearchAnnotation":{"adult":"...","violence":"...","racy":"..."}}]} ----

    private record AnnotateResponse(List<AnnotateResult> responses) {}

    private record AnnotateResult(SafeSearchAnnotation safeSearchAnnotation, ErrorInfo error) {}

    private record SafeSearchAnnotation(String adult, String violence, String racy) {}

    private record ErrorInfo(Integer code, String message) {}
}
