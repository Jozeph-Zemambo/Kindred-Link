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
        boolean seedDemoData) {

    /** finishHours: how long a person has to post their act after claiming a slot. */
    public record Node(int maxChildren, int finishHours) {}

    public record Continue(double maxDistanceMeters) {}

    public record Chain(int quietAfterHours, int maxDays) {}

    public record Privacy(double gridMeters) {}

    public record Business(double maxCheckinDistanceMeters) {}
}
