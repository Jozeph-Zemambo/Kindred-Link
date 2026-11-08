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
 * Slots are taken by claims (see NodeService.claim). Both NodeService (pins, claim rule) and
 * ChainService (chain map, chain status) count used slots with usedSlots() below, so they agree.
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
     * The moment a whole chain stops accepting links: maxDays (7) after its first (root) node was
     * created. After this, nobody can claim or post in the chain, even if people are still linking.
     */
    public Instant chainEndsAt(KindnessNode root) {
        return root.getCreatedAt().plus(Duration.ofDays(props.chain().maxDays()));
    }

    /**
     * When this node really stops taking claims: its own 12 h window, or the chain's 7-day hard
     * stop ({@code chainEnd}, from chainEndsAt(root)), whichever comes first. This is the closesAt
     * the app shows as a countdown, so it must never promise time past the chain's end.
     */
    public Instant closesAt(KindnessNode node, Instant chainEnd) {
        Instant ownWindow = closesAt(node);
        return ownWindow.isBefore(chainEnd) ? ownWindow : chainEnd;
    }

    /**
     * How many slots can still be claimed. {@code slotsUsed} is the number of slots already taken
     * (claimed, whether or not the claimer finished). Zero once the node's 12 h window or the
     * chain's 7-day hard stop has passed, so the map never shows a node that claim() would reject.
     */
    public int openSlots(KindnessNode node, long slotsUsed, Instant now, Instant chainEnd) {
        if (!now.isBefore(closesAt(node, chainEnd))) {
            return 0;
        }
        return (int) Math.max(0, props.node().maxChildren() - slotsUsed);
    }

    /**
     * How many of a node's slots are used up. A claim uses a slot, finished or not. We take the
     * bigger of claims and children because the demo seed data has children but no claims, and
     * those demo nodes shouldn't look open. Shared by NodeService and ChainService so the map
     * pins, the claim rule and the chain map always give the same answer.
     */
    public long usedSlots(long claimed, long children) {
        return Math.max(claimed, children);
    }
}
