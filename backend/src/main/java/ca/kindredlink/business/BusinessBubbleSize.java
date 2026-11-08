package ca.kindredlink.business;

/**
 * Maps a business's unique-device visitor count to a logical bubble diameter in units
 * (not pixels). Grows quickly at first, then in ever-wider brackets with halved slope
 * so a huge hub reads as bigger without swallowing the map.
 */
public final class BusinessBubbleSize {

    private BusinessBubbleSize() {}

    public static double diameterUnits(long visitors) {
        if (visitors < 0) {
            throw new IllegalArgumentException("visitors must not be negative");
        }
        if (visitors <= 50) {
            return 1.0 + visitors / 10.0;
        }
        long remaining = visitors - 50;
        long bracketWidth = 50;
        double denominator = 20.0;
        double diameter = 6.0;
        while (remaining > bracketWidth) {
            remaining -= bracketWidth;
            // Fixed +2.5 per bracket keeps growth visible while each bracket is
            // twice as wide as the last, so the slope halves every bracket.
            diameter += 2.5;
            bracketWidth *= 2;
            denominator *= 2;
        }
        return diameter + remaining / denominator;
    }
}
