package ca.kindredlink.photo;

/** Only low-risk SafeSearch results can bypass manual review. */
final class PhotoSafetyPolicy {

    private PhotoSafetyPolicy() {}

    static boolean canAutoApprove(String adult, String violence, String racy) {
        return lowRisk(adult) && lowRisk(violence) && lowRisk(racy);
    }

    private static boolean lowRisk(String likelihood) {
        return "VERY_UNLIKELY".equals(likelihood) || "UNLIKELY".equals(likelihood);
    }
}
