package ca.kindredlink.node;

import java.time.Duration;
import java.time.Instant;

import org.springframework.stereotype.Component;

import ca.kindredlink.KindredProperties;

/**
 * The branching rule, in one place.
 *
 * A node has up to {@code maxChildren} (2) slots. A slot stays claimable until the CHAIN ends
 * (chainEndsAt), not for a fixed 12 h: a node created with 3 days left on its chain stays open for
 * those 3 days.
 *
 * The {@code finishHours} (12) start only when someone claims a slot. That is their deadline to post
 * their act (capped at the chain's end, see NodeService.claim). A claim uses its slot for good,
 * finished or not, so a slot whose claimer runs out of time is never handed to someone else and the
 * node just ends up with fewer children.
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

    /**
     * The moment a whole chain stops accepting links: maxDays (7) after its first (root) node was
     * created. After this, nobody can claim or post in the chain, even if people are still linking.
     * It is also when every node in the chain stops taking claims (the "closesAt" the app shows).
     */
    public Instant chainEndsAt(KindnessNode root) {
        return root.getCreatedAt().plus(Duration.ofDays(props.chain().maxDays()));
    }

    /**
     * How many slots can still be claimed. {@code slotsUsed} is the number of slots already taken
     * (claimed, whether or not the claimer finished). Zero once the chain's 7-day hard stop has
     * passed, so the map never shows a node that claim() would reject.
     */
    public int openSlots(long slotsUsed, Instant now, Instant chainEnd) {
        if (!now.isBefore(chainEnd)) {
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
