package ca.kindredlink.photo;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class GoogleVisionSafetyCheckerTest {

    private static final byte[] IMAGE = "fake-cleaned-jpeg".getBytes(StandardCharsets.UTF_8);
    private static final String IMAGE_B64 = Base64.getEncoder().encodeToString(IMAGE);
    private static final String ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

    private RestClient.Builder builder;
    private MockRestServiceServer server;
    private GoogleVisionSafetyChecker checker;
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void setup() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        checker = new GoogleVisionSafetyChecker(new VisionModerationProperties("vision-test-key"), builder.build());
        logs = new ListAppender<>();
        logs.start();
        ((Logger) LoggerFactory.getLogger(GoogleVisionSafetyChecker.class)).addAppender(logs);
    }

    @AfterEach
    void detachLogs() {
        ((Logger) LoggerFactory.getLogger(GoogleVisionSafetyChecker.class)).detachAppender(logs);
    }

    private String warnings() {
        return logs.list.stream().map(e -> e.getFormattedMessage()).reduce("", (a, b) -> a + "\n" + b);
    }

    private void expectCall(String responseBody) {
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON));
    }

    private static String body(String adult, String violence, String racy) {
        return "{\"responses\":[{\"safeSearchAnnotation\":{\"adult\":" + json(adult)
                + ",\"violence\":" + json(violence) + ",\"racy\":" + json(racy) + "}}]}";
    }

    private static String json(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }

    @Test
    void sendsCleanedImageWithKeyInHeaderNotUrl() {
        server.expect(requestTo(ENDPOINT)) // exact match: no ?key= on the URL
                .andExpect(header("X-Goog-Api-Key", "vision-test-key"))
                .andExpect(header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().string(containsString("\"content\":\"" + IMAGE_B64 + "\"")))
                .andExpect(content().string(containsString("\"type\":\"SAFE_SEARCH_DETECTION\"")))
                .andRespond(withSuccess(body("VERY_UNLIKELY", "VERY_UNLIKELY", "VERY_UNLIKELY"), MediaType.APPLICATION_JSON));

        assertTrue(checker.isSafe(IMAGE));
        server.verify();
    }

    @Test
    void fullGoogleShapeApproves() {
        // The real SafeSearch response carries five categories, not just the three we read.
        expectCall("{\"responses\":[{\"safeSearchAnnotation\":{\"adult\":\"VERY_UNLIKELY\",\"spoof\":\"VERY_UNLIKELY\",\"medical\":\"VERY_UNLIKELY\",\"violence\":\"VERY_UNLIKELY\",\"racy\":\"VERY_UNLIKELY\"}}]}");
        assertTrue(checker.isSafe(IMAGE));
    }

    @Test
    void allVeryUnlikelyAndAllUnlikelyApprove() {
        expectCall(body("VERY_UNLIKELY", "VERY_UNLIKELY", "VERY_UNLIKELY"));
        expectCall(body("UNLIKELY", "UNLIKELY", "UNLIKELY"));
        assertTrue(checker.isSafe(IMAGE));
        assertTrue(checker.isSafe(IMAGE));
    }

    @Test
    void anyNonMinimalLikelihoodStaysManual() {
        String[] fields = {"adult", "violence", "racy"};
        String[] badValues = {"POSSIBLE", "LIKELY", "VERY_LIKELY", "UNKNOWN", null, "", "MAYBE"};
        for (String field : fields) {
            for (String bad : badValues) {
                expectCall(body(
                        "adult".equals(field) ? bad : "VERY_UNLIKELY",
                        "violence".equals(field) ? bad : "VERY_UNLIKELY",
                        "racy".equals(field) ? bad : "VERY_UNLIKELY"));
            }
            // A number where a likelihood word belongs is also not approvable.
            expectCall(body("VERY_UNLIKELY", "VERY_UNLIKELY", "VERY_UNLIKELY")
                    .replace("\"" + field + "\":\"VERY_UNLIKELY\"", "\"" + field + "\":2"));
        }
        for (String field : fields) {
            for (int i = 0; i < badValues.length; i++) {
                assertFalse(checker.isSafe(IMAGE), field + " case " + i);
            }
            assertFalse(checker.isSafe(IMAGE), field + " numeric");
        }
    }

    @Test
    void unexpectedPayloadsStayManual() {
        String clean = "\"safeSearchAnnotation\":{\"adult\":\"VERY_UNLIKELY\",\"violence\":\"VERY_UNLIKELY\",\"racy\":\"VERY_UNLIKELY\"}";
        String[] bad = {
                "{\"responses\":[{}]}",                                        // annotation missing
                "{\"responses\":[{\"error\":{\"code\":3,\"message\":\"bad\"}," + clean + "}]}", // provider error wins
                "{\"responses\":[]}",                                          // zero results
                "{\"responses\":[{" + clean + "},{" + clean + "}]}",           // two results
                "{\"responses\":[null]}",                                      // null result
                "{}",                                                          // responses absent
                "",                                                            // empty body
                "not json",                                                    // malformed JSON
        };
        for (String payload : bad) {
            expectCall(payload);
        }
        for (String payload : bad) {
            assertFalse(checker.isSafe(IMAGE), "payload: " + payload);
        }
    }

    @Test
    void httpErrorsAndTimeoutsStayManual() {
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.FORBIDDEN));
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        server.expect(requestTo(ENDPOINT)).andRespond(req -> {
            throw new SocketTimeoutException("simulated read timeout");
        });
        assertFalse(checker.isSafe(IMAGE)); // 403
        assertFalse(checker.isSafe(IMAGE)); // 429
        assertFalse(checker.isSafe(IMAGE)); // 500
        assertFalse(checker.isSafe(IMAGE)); // transport timeout
    }

    @Test
    void unknownExtraFieldsAreTolerated() {
        // Extra provider fields anywhere (annotation, error, top level) must not break the decision.
        expectCall("{\"responses\":[{\"safeSearchAnnotation\":{\"adult\":\"VERY_UNLIKELY\",\"violence\":\"VERY_UNLIKELY\",\"racy\":\"VERY_UNLIKELY\",\"future\":{\"nested\":[1,2]}},\"futureTop\":42}]}");
        // An error still loses to nothing, no matter what else the result carries.
        expectCall("{\"responses\":[{\"error\":{\"code\":3,\"message\":\"bad\",\"status\":\"INVALID_ARGUMENT\",\"details\":[{\"@type\":\"x\",\"reason\":\"NOT_LISTED\",\"metadata\":{\"a\":1}}],\"extra\":true}}]}");
        assertTrue(checker.isSafe(IMAGE));
        assertFalse(checker.isSafe(IMAGE));
    }

    @Test
    void httpErrorLogsStatusAndAllowlistedReasonOnly() {
        String hostile = "key=fakekey123 img=" + IMAGE_B64;
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.FORBIDDEN)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\":{\"code\":403,\"message\":\"referrer blocked " + hostile + "\",\"status\":\"PERMISSION_DENIED\",\"details\":[{\"@type\":\"type.googleapis.com/google.rpc.ErrorInfo\",\"reason\":\"API_KEY_SERVICE_BLOCKED\",\"domain\":\"googleapis.com\",\"metadata\":{\"service\":\"vision.googleapis.com\"}}]}}"));

        assertFalse(checker.isSafe(IMAGE));

        String msg = warnings();
        assertTrue(msg.contains("HTTP 403"), msg);
        assertTrue(msg.contains("reason=API_KEY_SERVICE_BLOCKED"), msg);
        assertFalse(msg.contains("fakekey123"), msg);
        assertFalse(msg.contains(IMAGE_B64), msg);
        assertFalse(msg.contains("referrer blocked"), msg);
    }

    @Test
    void unrecognizedReasonLogsUnknownNotTheText() {
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.FORBIDDEN)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\":{\"code\":403,\"message\":\"x\",\"status\":\"PERMISSION_DENIED\",\"details\":[{\"reason\":\"EVIL\\ninjection fakekey123\"}]}}"));

        assertFalse(checker.isSafe(IMAGE));

        String msg = warnings();
        assertTrue(msg.contains("reason=UNKNOWN"), msg);
        assertFalse(msg.contains("EVIL"), msg);
        assertFalse(msg.contains("fakekey123"), msg);
    }

    @Test
    void malformedErrorBodyStillLogsStatusAndUnknown() {
        server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                .contentType(MediaType.APPLICATION_JSON)
                .body("not json at all {key=fakekey123"));

        assertFalse(checker.isSafe(IMAGE));

        String msg = warnings();
        assertTrue(msg.contains("HTTP 500"), msg);
        assertTrue(msg.contains("reason=UNKNOWN"), msg);
        assertFalse(msg.contains("fakekey123"), msg);
    }

    @Test
    void timeoutLogsNetworkCategoryNotDetails() {
        server.expect(requestTo(ENDPOINT)).andRespond(req -> {
            throw new SocketTimeoutException("simulated read timeout fakekey123");
        });

        assertFalse(checker.isSafe(IMAGE));

        String msg = warnings();
        assertTrue(msg.contains("NETWORK_OR_TIMEOUT"), msg);
        assertFalse(msg.contains("fakekey123"), msg);
        assertFalse(msg.contains("SocketTimeout"), msg);
    }

    @Test
    void malformedSuccessBodyLogsClientErrorCategory() {
        expectCall("this is not json {key=fakekey123}");

        assertFalse(checker.isSafe(IMAGE));

        String msg = warnings();
        assertTrue(msg.contains("RESPONSE_OR_CLIENT_ERROR"), msg);
        assertFalse(msg.contains("fakekey123"), msg);
    }

    @Test
    void blankOrMissingKeyMakesNoRequest() {
        // Any actual call would make MockRestServiceServer raise "no further requests expected",
        // which is an Error the checker cannot swallow - reaching the asserts proves silence.
        GoogleVisionSafetyChecker off = new GoogleVisionSafetyChecker(new VisionModerationProperties(""), builder.build());
        GoogleVisionSafetyChecker blank = new GoogleVisionSafetyChecker(new VisionModerationProperties("   "), builder.build());
        GoogleVisionSafetyChecker missing = new GoogleVisionSafetyChecker(new VisionModerationProperties(null), builder.build());
        assertFalse(off.isSafe(IMAGE));
        assertFalse(blank.isSafe(IMAGE));
        assertFalse(missing.isSafe(IMAGE));
        server.verify();
    }
}
