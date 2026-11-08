package ca.kindredlink.photo;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Google Cloud Vision key for automatic photo screening, bound from
 * {@code kindred.moderation.vision}. Kept separate from KindredProperties.Moderation so the
 * manual moderator key is untouched. Empty key = screening off, every upload goes to the queue.
 */
@ConfigurationProperties(prefix = "kindred.moderation.vision")
public record VisionModerationProperties(String apiKey) {}
