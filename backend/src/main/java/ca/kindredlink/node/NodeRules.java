package ca.kindredlink.node;

import ca.kindredlink.KindredProperties;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

/**
 * The branching rule, in one place.
 *
 * Reading of the spec used here: a node accepts up to {@code maxChildren} (2) continuations, and
 * only within {@code openHours} (12) of being created. When the window closes, any unfilled slot is
 * gone for good, so a node that got one child in time stays at one child.
 *
 * If the team wants per-slot timers instead (someone "claims" a slot and has 12 h to finish it),
 * this class and NodeService.continueChain are the only places to change.
 */
@Component
public class NodeRules {

    private final KindredProperties props;

    public NodeRules(KindredProperties props) {
        this.props = props;
    }

    public Instant closesAt(KindnessNode node) {
        return node.getCreatedAt().plus(Duration.ofHours(props.node().openHours()));
    }

    /**
     * How many slots can still be claimed. {@code slotsUsed} is the number of slots already taken
     * (claimed, whether or not the claimer finished). Zero once the claim window has closed.
     */
    public int openSlots(KindnessNode node, long slotsUsed, Instant now) {
        if (!now.isBefore(closesAt(node))) {
            return 0;
        }
        return (int) Math.max(0, props.node().maxChildren() - slotsUsed);
    }
}
