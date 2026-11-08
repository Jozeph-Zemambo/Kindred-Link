package ca.kindredlink.business;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/** One verified QR scan at a business till. nodeId is set when the visit was an act of kindness. */
@Entity
@Table(indexes = @Index(columnList = "businessId"))
public class Checkin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long businessId;

    @Column(nullable = false)
    private String deviceId;

    private Long nodeId;

    @Column(nullable = false)
    private Instant createdAt;

    protected Checkin() {}

    public Checkin(Long businessId, String deviceId, Long nodeId, Instant createdAt) {
        this.businessId = businessId;
        this.deviceId = deviceId;
        this.nodeId = nodeId;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public Long getBusinessId() { return businessId; }
    public String getDeviceId() { return deviceId; }
    public Long getNodeId() { return nodeId; }
    public Instant getCreatedAt() { return createdAt; }
}
