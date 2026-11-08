package ca.kindredlink.business;

import ca.kindredlink.KindredProperties;
import ca.kindredlink.business.BusinessDtos.BusinessHub;
import ca.kindredlink.business.BusinessDtos.CheckinRequest;
import ca.kindredlink.business.BusinessDtos.CheckinResult;
import ca.kindredlink.common.ApiException;
import ca.kindredlink.geo.Geo;
import ca.kindredlink.node.KindnessNode;
import ca.kindredlink.node.NodeRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BusinessService {

    private final BusinessRepository businesses;
    private final CheckinRepository checkins;
    private final NodeRepository nodes;
    private final KindredProperties props;
    private final Clock clock;

    public BusinessService(BusinessRepository businesses, CheckinRepository checkins, NodeRepository nodes,
            KindredProperties props, Clock clock) {
        this.businesses = businesses;
        this.checkins = checkins;
        this.nodes = nodes;
        this.props = props;
        this.clock = clock;
    }

    public List<BusinessHub> list() {
        Map<Long, CheckinRepository.BusinessCounts> counts = counts();
        Instant now = clock.instant();
        return businesses.findAll().stream()
                .map(b -> toHub(b, counts.get(b.getId()), now)).toList();
    }

    /** Verify the till QR token and that the device is actually at the business, then record it. */
    @Transactional
    public CheckinResult checkin(Long businessId, CheckinRequest req, String deviceId) {
        Business b = businesses.findById(businessId).orElseThrow(() -> ApiException.notFound("Business", businessId));
        if (!b.getQrToken().equals(req.token())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "bad_token", "That QR code doesn't belong to " + b.getName());
        }
        double max = props.business().maxCheckinDistanceMeters();
        if (Geo.distanceMeters(b.getLat(), b.getLng(), req.lat(), req.lng()) > max) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "too_far",
                    "You need to be at " + b.getName() + " to check in");
        }
        if (req.nodeId() != null) {
            KindnessNode node = nodes.findById(req.nodeId()).orElseThrow(() -> ApiException.notFound("Node", req.nodeId()));
            if (!node.getAuthorDeviceId().equals(deviceId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "not_your_node", "You can only link your own act of kindness");
            }
        }
        Instant at = clock.instant();
        Checkin saved = checkins.save(new Checkin(businessId, deviceId, req.nodeId(), at));
        return new CheckinResult(saved.getId(), toHub(b, counts().get(businessId), at));
    }

    private Map<Long, CheckinRepository.BusinessCounts> counts() {
        return checkins.countsByBusiness().stream()
                .collect(Collectors.toMap(CheckinRepository.BusinessCounts::getBusinessId, Function.identity()));
    }

    private static BusinessHub toHub(Business b, CheckinRepository.BusinessCounts c, Instant now) {
        long visitors = c == null ? 0 : c.getVisitors();
        Instant last = c == null ? null : c.getLastKindnessAt();
        return new BusinessHub(b.getId(), b.getName(), b.getLogoUrl(), b.getLat(), b.getLng(),
                visitors, c == null ? 0 : c.getKindnessActs(), BusinessBubbleSize.diameterUnits(visitors),
                last, BusinessActivity.opacity(last, now));
    }
}
