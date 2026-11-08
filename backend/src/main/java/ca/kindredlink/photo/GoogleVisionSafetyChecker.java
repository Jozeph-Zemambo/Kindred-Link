package ca.kindredlink.photo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

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
        } catch (RestClientResponseException e) {
            // HTTP error: only the numeric status and an allowlisted provider reason are safe to log.
            log.warn("Photo safety screening failed (HTTP {}, reason={}); leaving the photo pending for manual review",
                    e.getStatusCode().value(), reason(e));
            return false;
        } catch (ResourceAccessException e) {
            log.warn("Photo safety screening failed ({}); leaving the photo pending for manual review", "NETWORK_OR_TIMEOUT");
            return false;
        } catch (Exception e) {
            log.warn("Photo safety screening failed ({}); leaving the photo pending for manual review", "RESPONSE_OR_CLIENT_ERROR");
            return false;
        }
    }

    // Google's ErrorInfo reasons that are safe to surface - no message text, so nothing a caller
    // or provider can smuggle into our logs. Anything else collapses to UNKNOWN.
    private static final Set<String> SAFE_REASONS = Set.of(
            "API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED",
            "API_KEY_IP_ADDRESS_BLOCKED", "API_KEY_ANDROID_APP_BLOCKED", "API_KEY_IOS_APP_BLOCKED",
            "SERVICE_DISABLED", "BILLING_DISABLED", "RATE_LIMIT_EXCEEDED", "QUOTA_EXCEEDED");

    private static String reason(RestClientResponseException e) {
        try {
            ErrorEnvelope envelope = e.getResponseBodyAs(ErrorEnvelope.class);
            ErrorDetail error = envelope == null ? null : envelope.error();
            if (error == null || error.details() == null) {
                return "UNKNOWN";
            }
            for (ErrorDetailItem detail : error.details()) {
                if (detail != null && detail.reason() != null && SAFE_REASONS.contains(detail.reason())) {
                    return detail.reason();
                }
            }
        } catch (Exception ignored) {
            // An unreadable body is still no reason to leak it - UNKNOWN is the safe label.
        }
        return "UNKNOWN";
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

    // ---- error envelope shape: {"error":{"code":403,"status":"...","details":[{"reason":"..."}]}} ----

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ErrorEnvelope(ErrorDetail error) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ErrorDetail(Integer code, String status, List<ErrorDetailItem> details) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ErrorDetailItem(String reason) {}
}
