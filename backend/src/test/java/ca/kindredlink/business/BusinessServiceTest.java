package ca.kindredlink.business;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.kindredlink.business.BusinessDtos.BusinessHub;
import ca.kindredlink.business.BusinessDtos.CheckinRequest;
import ca.kindredlink.business.BusinessDtos.CheckinResult;
import ca.kindredlink.common.ApiException;
import ca.kindredlink.common.DeviceId;
import ca.kindredlink.node.KindnessNode;
import ca.kindredlink.node.NodeRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class BusinessServiceTest {

    private static final double EPS = 1e-9;

    @Autowired
    private BusinessService service;

    @Autowired
    private BusinessRepository businesses;

    @Autowired
    private CheckinRepository checkins;

    @Autowired
    private NodeRepository nodes;

    @Autowired
    private MockMvc mvc;

    private BusinessHub find(long businessId) {
        return service.list().stream()
                .filter(h -> h.id() == businessId)
                .findFirst()
                .orElseThrow(() -> new AssertionError("business " + businessId + " not listed"));
    }

    private static CheckinRequest scan(String token, double lat, double lng) {
        return new CheckinRequest(token, lat, lng, null);
    }

    @Test
    void uniqueDevicesGrowDiameter() {
        Business b = businesses.save(new Business("Bubble Cafe", null, 51.0, -114.0, "test-bubble"));
        long id = b.getId();

        BusinessHub fresh = find(id);
        assertEquals(0, fresh.visitors());
        assertEquals(1.0, fresh.diameterUnits(), EPS);

        CheckinResult first = service.checkin(id, scan("test-bubble", 51.0, -114.0), "deviceA");
        assertEquals(1, first.business().visitors());
        assertEquals(1.1, first.business().diameterUnits(), EPS);

        // A repeat scan by the same device is recorded but does not grow the bubble.
        CheckinResult repeat = service.checkin(id, scan("test-bubble", 51.0, -114.0), "deviceA");
        assertEquals(1, repeat.business().visitors());
        assertEquals(1.1, repeat.business().diameterUnits(), EPS);

        CheckinResult second = service.checkin(id, scan("test-bubble", 51.0, -114.0), "deviceB");
        assertEquals(2, second.business().visitors());
        assertEquals(1.2, second.business().diameterUnits(), EPS);

        BusinessHub listed = find(id);
        assertEquals(2, listed.visitors());
        assertEquals(1.2, listed.diameterUnits(), EPS);
    }

    @Test
    void visitorsAreIndependentPerBusiness() {
        Business a = businesses.save(new Business("Hub A", null, 51.0, -114.0, "tok-a"));
        Business b = businesses.save(new Business("Hub B", null, 51.0, -114.0, "tok-b"));

        service.checkin(a.getId(), scan("tok-a", 51.0, -114.0), "deviceA");
        CheckinResult atB = service.checkin(b.getId(), scan("tok-b", 51.0, -114.0), "deviceA");

        // Same device counts once per business, not once globally.
        assertEquals(1, atB.business().visitors());
        assertEquals(1.1, atB.business().diameterUnits(), EPS);
        assertEquals(1, find(b.getId()).visitors());
        assertEquals(1, find(a.getId()).visitors());
    }

    @Test
    void invalidTokenAndFarLocationRejectedWithoutCounting() {
        Business b = businesses.save(new Business("Guarded Hub", null, 51.0, -114.0, "good-token"));

        ApiException badToken = assertThrows(ApiException.class,
                () -> service.checkin(b.getId(), scan("wrong-token", 51.0, -114.0), "deviceA"));
        assertEquals("bad_token", badToken.getBody().getTitle());

        ApiException tooFar = assertThrows(ApiException.class,
                () -> service.checkin(b.getId(), scan("good-token", 52.0, -114.0), "deviceA"));
        assertEquals("too_far", tooFar.getBody().getTitle());

        BusinessHub hub = find(b.getId());
        assertEquals(0, hub.visitors());
        assertEquals(1.0, hub.diameterUnits(), EPS);
    }

    @Test
    void diameterUnitsSerializedOnListAndCheckinResponses() throws Exception {
        Business b = businesses.save(new Business("Api Hub", null, 51.0, -114.0, "api-token"));

        mvc.perform(get("/api/businesses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + b.getId() + ")].diameterUnits").value(contains(1.0)));

        mvc.perform(post("/api/businesses/{id}/checkin", b.getId())
                        .header(DeviceId.HEADER, "deviceX")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"api-token\",\"lat\":51.0,\"lng\":-114.0}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.business.visitors").value(1))
                .andExpect(jsonPath("$.business.diameterUnits").value(1.1));
    }

    @Test
    void onlyLinkedCheckinsRefreshKindnessRecency() {
        Business b = businesses.save(new Business("Kind Cafe", null, 51.0, -114.0, "kind-token"));

        // Fresh + raw scans: no linked act ever, so null timestamp and 0.25.
        assertNull(find(b.getId()).lastKindnessAt());
        assertEquals(0.25, find(b.getId()).opacity(), EPS);
        CheckinResult raw = service.checkin(b.getId(), scan("kind-token", 51.0, -114.0), "deviceK");
        assertNull(raw.business().lastKindnessAt());
        assertEquals(0.25, raw.business().opacity(), EPS);

        // A scan linked to this device's own kindness node sets the timestamp.
        KindnessNode node = nodes.findAll().get(0);
        CheckinResult linked = service.checkin(b.getId(),
                new CheckinRequest("kind-token", 51.0, -114.0, node.getId()),
                node.getAuthorDeviceId());
        assertNotNull(linked.business().lastKindnessAt());
        assertEquals(1.0, linked.business().opacity(), EPS);
        Instant last = find(b.getId()).lastKindnessAt();
        assertNotNull(last);
        assertTrue(last.isBefore(Instant.now().plusSeconds(5))
                && last.isAfter(Instant.now().minusSeconds(60)),
                "expected a fresh linked timestamp, got " + last);

        // Another raw scan afterwards must NOT move or clear it.
        CheckinResult after = service.checkin(b.getId(), scan("kind-token", 51.0, -114.0), "deviceZ");
        assertEquals(last, after.business().lastKindnessAt());
        assertEquals(1.0, after.business().opacity(), EPS);
    }

    @Test
    void lastKindnessAtIgnoresUnlinkedAndOtherBusinessScans() {
        Business a = businesses.save(new Business("Aged Hub", null, 51.0, -114.0, "tok-aged"));
        Business b = businesses.save(new Business("Other Hub", null, 51.0, -114.0, "tok-other"));
        KindnessNode node = nodes.findAll().get(0);
        Instant twoDaysAgo = Instant.now().minus(2, ChronoUnit.DAYS)
                .truncatedTo(ChronoUnit.MICROS);

        // Linked act 2 days ago wins over an older linked act AND a newer raw scan.
        checkins.save(new Checkin(a.getId(), node.getAuthorDeviceId(), node.getId(),
                Instant.now().minus(3, ChronoUnit.DAYS)));
        checkins.save(new Checkin(a.getId(), node.getAuthorDeviceId(), node.getId(), twoDaysAgo));
        checkins.save(new Checkin(a.getId(), "deviceR", null, Instant.now()));
        // Raw-only scans on the other business leave it at none/0.25.
        checkins.save(new Checkin(b.getId(), "deviceS", null, Instant.now()));

        BusinessHub hubA = find(a.getId());
        assertEquals(twoDaysAgo, hubA.lastKindnessAt());
        assertEquals(0.5, hubA.opacity(), EPS);
        assertEquals(2, hubA.kindnessActs());
        BusinessHub hubB = find(b.getId());
        assertNull(hubB.lastKindnessAt());
        assertEquals(0.25, hubB.opacity(), EPS);
    }

    @Test
    void kindnessRecencySerializedOnListAndCheckin() throws Exception {
        Business b = businesses.save(new Business("Serial Hub", null, 51.0, -114.0, "ser-token"));

        mvc.perform(get("/api/businesses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + b.getId() + ")].lastKindnessAt")
                        .value(contains(nullValue())))
                .andExpect(jsonPath("$[?(@.id == " + b.getId() + ")].opacity")
                        .value(contains(0.25)));

        KindnessNode node = nodes.findAll().get(0);
        mvc.perform(post("/api/businesses/{id}/checkin", b.getId())
                        .header(DeviceId.HEADER, node.getAuthorDeviceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"ser-token\",\"lat\":51.0,\"lng\":-114.0,"
                                + "\"nodeId\":" + node.getId() + "}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.business.lastKindnessAt").isString())
                .andExpect(jsonPath("$.business.opacity").value(1.0));
    }
}
