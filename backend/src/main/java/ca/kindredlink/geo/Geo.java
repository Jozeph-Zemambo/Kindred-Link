package ca.kindredlink.geo;

import java.util.concurrent.ThreadLocalRandom;

/** Small geo helpers. Flat-earth grid maths is fine at city scale. */
public final class Geo {
    private static final double EARTH_RADIUS_M = 6_371_000;
    private static final double METERS_PER_DEG_LAT = 111_320;

    private Geo() {}

    public record LatLng(double lat, double lng) {}

    /** Great-circle distance in metres (haversine). */
    public static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
    }

    /**
     * Dox protection: snap the real point to a grid cell of {@code gridMeters}, then jitter it
     * randomly inside that cell. Call once at creation and store the result; re-randomising on
     * every read would let someone average many reads back to the true cell centre.
     */
    public static LatLng approximate(double lat, double lng, double gridMeters) {
        double cellLat = gridMeters / METERS_PER_DEG_LAT;
        double cellLng = gridMeters / (METERS_PER_DEG_LAT * Math.cos(Math.toRadians(lat)));
        double centreLat = (Math.floor(lat / cellLat) + 0.5) * cellLat;
        double centreLng = (Math.floor(lng / cellLng) + 0.5) * cellLng;
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        return new LatLng(
                centreLat + rnd.nextDouble(-0.4, 0.4) * cellLat,
                centreLng + rnd.nextDouble(-0.4, 0.4) * cellLng);
    }

    /**
     * Stand-in for "neighbourhood": a ~1 km grid cell key. Replace with real community
     * boundaries (Calgary open data) if there's time.
     */
    public static String neighbourhoodKey(double lat, double lng) {
        double cellLat = 1000 / METERS_PER_DEG_LAT;
        double cellLng = 1000 / (METERS_PER_DEG_LAT * Math.cos(Math.toRadians(lat)));
        return (long) Math.floor(lat / cellLat) + ":" + (long) Math.floor(lng / cellLng);
    }
}
