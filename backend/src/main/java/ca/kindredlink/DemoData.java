package ca.kindredlink;

import ca.kindredlink.business.Business;
import ca.kindredlink.business.BusinessRepository;
import ca.kindredlink.geo.Geo;
import ca.kindredlink.node.KindnessNode;
import ca.kindredlink.node.NodeRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds an empty database with a few chains and businesses around Calgary so the map isn't blank.
 * Turn off with kindred.seed-demo-data=false. Seeded authors use "demo-*" device ids, so your
 * phone can continue any of them. Business locations, names, and logos were provided by the
 * demo owner for simulation purposes only - they are not geocoder-verified and imply no
 * partnership. Participation starts at zero.
 */
@Component
public class DemoData implements ApplicationRunner {

    private final NodeRepository nodes;
    private final BusinessRepository businesses;
    private final KindredProperties props;
    private final Clock clock;

    public DemoData(NodeRepository nodes, BusinessRepository businesses, KindredProperties props, Clock clock) {
        this.nodes = nodes;
        this.businesses = businesses;
        this.props = props;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!props.seedDemoData() || nodes.count() > 0) {
            return;
        }
        Instant now = clock.instant();

        // Active chain: started 5 h ago at the ICT building, now 4 links deep.
        KindnessNode a = root("demo-alice", "Paid for the coffee of the person behind me", 51.0802, -114.1305, now.minus(hours(5)));
        KindnessNode b = child(a, "demo-ben", "Held the door and helped carry boxes", 51.0789, -114.1318, now.minus(hours(4)));
        KindnessNode c = child(a, "demo-cam", "Left a kind note on a bus seat", 51.0771, -114.1290, now.minus(hours(3)));
        child(b, "demo-dee", "Shovelled a neighbour's walk", 51.0760, -114.1335, now.minus(hours(1)));
        child(c, "demo-eli", "Bought lunch for a classmate", 51.0748, -114.1272, now.minus(Duration.ofMinutes(30)));

        // Quiet chain: open slots, but nothing new for a while.
        root("demo-fay", "Returned a lost wallet", 51.0850, -114.1400, now.minus(hours(6)));

        // Ended chain: windows long closed.
        KindnessNode old = root("demo-gus", "Gave away spare winter gloves", 51.0700, -114.1200, now.minus(hours(40)));
        child(old, "demo-hal", "Paid a parking meter about to expire", 51.0712, -114.1185, now.minus(hours(35)));

        // User-provided demo businesses; QR tokens are random so they cannot be guessed.
        businesses.save(new Business("Cinnzeo Bakery Cafe",
                "/images/businesses/cinnzeo-bakery-cafe.png",
                51.07923, -114.127219, UUID.randomUUID().toString()));
        businesses.save(new Business("Lotus Fine Indian Cuisine - Charleswood",
                "/images/businesses/lotus-charleswood.png",
                51.087303, -114.109781, UUID.randomUUID().toString()));
    }

    private KindnessNode root(String device, String text, double lat, double lng, Instant at) {
        KindnessNode n = nodes.save(node(null, null, 0, device, text, lat, lng, at));
        n.setChainId(n.getId());
        return n;
    }

    private KindnessNode child(KindnessNode parent, String device, String text, double lat, double lng, Instant at) {
        return nodes.save(node(parent.getChainId(), parent.getId(), parent.getDepth() + 1, device, text, lat, lng, at));
    }

    private KindnessNode node(Long chainId, Long parentId, int depth, String device, String text,
            double lat, double lng, Instant at) {
        Geo.LatLng approx = Geo.approximate(lat, lng, props.privacy().gridMeters());
        return new KindnessNode(chainId, parentId, depth, device, text, null, lat, lng, approx.lat(), approx.lng(), at);
    }

    private static Duration hours(long h) {
        return Duration.ofHours(h);
    }
}
