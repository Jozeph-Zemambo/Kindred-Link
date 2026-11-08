package ca.kindredlink.node;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * One person reserving one of a node's two slots. A claim uses up a slot for good, whether or not
 * the person finishes, so a slot that goes unfinished is never handed to someone else.
 */
@Entity
@Table(name = "node_claim",
        indexes = @Index(columnList = "nodeId"),
        uniqueConstraints = @UniqueConstraint(columnNames = {"nodeId", "deviceId"}))
public class NodeClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The parent node being claimed. */
    @Column(nullable = false)
    private Long nodeId;

    /** Who claimed it. */
    @Column(nullable = false)
    private String deviceId;

    @Column(nullable = false)
    private Instant claimedAt;

    /** Set when the claimer posts their act. Null means not finished yet. */
    private Long childId;

    protected NodeClaim() {}

    public NodeClaim(Long nodeId, String deviceId, Instant claimedAt) {
        this.nodeId = nodeId;
        this.deviceId = deviceId;
        this.claimedAt = claimedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getNodeId() {
        return nodeId;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public Instant getClaimedAt() {
        return claimedAt;
    }

    public Long getChildId() {
        return childId;
    }

    public void setChildId(Long childId) {
        this.childId = childId;
    }
}
