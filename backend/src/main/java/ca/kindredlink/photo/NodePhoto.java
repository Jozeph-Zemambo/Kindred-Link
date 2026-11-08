package ca.kindredlink.photo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One uploaded photo. The image bytes live in the database (free hosts wipe local disk, so files
 * on disk would vanish). The bytes stored here are always the CLEANED version from ImageCleaner:
 * no GPS, no camera info.
 */
@Entity
@Table(name = "node_photo", indexes = @Index(columnList = "status"))
public class NodePhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Who uploaded it (their verified Auth0 account). */
    @Column(nullable = false)
    private String uploaderDeviceId;

    /** The cleaned JPEG, as raw bytes. */
    @Lob
    @Column(nullable = false)
    private byte[] data;

    /** PENDING until a moderator approves it. Stored as text so the table stays readable. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PhotoStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    /** The node this photo belongs to. Null until the app attaches it to a node. */
    private Long nodeId;

    protected NodePhoto() {}

    /** A brand-new photo always starts out PENDING. */
    public NodePhoto(String uploaderDeviceId, byte[] data, Instant createdAt) {
        this.uploaderDeviceId = uploaderDeviceId;
        this.data = data;
        this.createdAt = createdAt;
        this.status = PhotoStatus.PENDING;
    }

    public Long getId() {
        return id;
    }

    public String getUploaderDeviceId() {
        return uploaderDeviceId;
    }

    public byte[] getData() {
        return data;
    }

    public PhotoStatus getStatus() {
        return status;
    }

    public void setStatus(PhotoStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Long getNodeId() {
        return nodeId;
    }

    public void setNodeId(Long nodeId) {
        this.nodeId = nodeId;
    }
}
