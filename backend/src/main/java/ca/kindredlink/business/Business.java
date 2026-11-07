package ca.kindredlink.business;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

/** A static hub on the map. Its location is public; the QR token printed at the till is not. */
@Entity
public class Business {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** Shown as the face of the business pin. */
    private String logoUrl;

    private double lat;
    private double lng;

    /** Encoded in the till QR as kindredlink://checkin?business={id}&token={qrToken}. */
    @Column(nullable = false)
    private String qrToken;

    protected Business() {}

    public Business(String name, String logoUrl, double lat, double lng, String qrToken) {
        this.name = name;
        this.logoUrl = logoUrl;
        this.lat = lat;
        this.lng = lng;
        this.qrToken = qrToken;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getLogoUrl() { return logoUrl; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public String getQrToken() { return qrToken; }
}
