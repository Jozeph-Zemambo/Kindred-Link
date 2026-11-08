package ca.kindredlink.node;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * One act of kindness. A chain is the tree of nodes under a root; {@code chainId} is the root's id.
 * The exact lat/lng never leaves the server: responses only use approxLat/approxLng.
 */
@Entity
@Table(indexes = {@Index(columnList = "chainId"), @Index(columnList = "parentId")})
public class KindnessNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Root node id. Null only for a root before its first save; see NodeService.createRoot. */
    private Long chainId;

    private Long parentId;

    private int depth;

    @Column(nullable = false)
    private String authorDeviceId;

    @Column(nullable = false, length = 500)
    private String description;

    private String photoUrl;

    private double lat;
    private double lng;
    private double approxLat;
    private double approxLng;

    @Column(nullable = false)
    private Instant createdAt;

    protected KindnessNode() {}

    public KindnessNode(Long chainId, Long parentId, int depth, String authorDeviceId, String description,
            String photoUrl, double lat, double lng, double approxLat, double approxLng, Instant createdAt) {
        this.chainId = chainId;
        this.parentId = parentId;
        this.depth = depth;
        this.authorDeviceId = authorDeviceId;
        this.description = description;
        this.photoUrl = photoUrl;
        this.lat = lat;
        this.lng = lng;
        this.approxLat = approxLat;
        this.approxLng = approxLng;
        this.createdAt = createdAt;
    }

    public boolean isRoot() {
        return parentId == null;
    }

    public Long getId() { return id; }
    public Long getChainId() { return chainId; }
    public void setChainId(Long chainId) { this.chainId = chainId; }
    public Long getParentId() { return parentId; }
    public int getDepth() { return depth; }
    public String getAuthorDeviceId() { return authorDeviceId; }
    public String getDescription() { return description; }
    public String getPhotoUrl() { return photoUrl; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public double getApproxLat() { return approxLat; }
    public double getApproxLng() { return approxLng; }
    public Instant getCreatedAt() { return createdAt; }
}
