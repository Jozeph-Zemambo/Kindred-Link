package ca.kindredlink;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Tunable game rules, bound from the {@code kindred.*} block in application.yml. */
@ConfigurationProperties(prefix = "kindred")
public record KindredProperties(
        Node node,
        Continue continueRules,
        Chain chain,
        Privacy privacy,
        Business business,
        Moderation moderation,
        boolean seedDemoData) {

    /** finishHours: how long a person has to post their act after claiming a slot. */
    public record Node(int maxChildren, int finishHours) {}

    /** Distance allowed when reserving a visible node; it does not apply when posting later. */
    public record Continue(double maxDistanceMeters) {}

    public record Chain(int quietAfterHours, int maxDays) {}

    public record Privacy(double gridMeters) {}

    public record Business(double maxCheckinDistanceMeters) {}

    /** adminKey: the secret a moderator sends in the X-Admin-Key header. Empty = moderation is switched off. */
    public record Moderation(String adminKey) {}
}
