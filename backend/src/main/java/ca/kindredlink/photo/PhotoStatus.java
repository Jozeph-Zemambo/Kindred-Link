package ca.kindredlink.photo;

/**
 * Where a photo is in moderation. Every uploaded photo starts as PENDING and is hidden from
 * everyone else until a moderator approves it.
 */
public enum PhotoStatus {
    /** Just uploaded, waiting for a moderator. Not shown to anyone else. */
    PENDING,
    /** A moderator said it's fine. Anyone can see it. */
    APPROVED,
    /** A moderator turned it down. Never shown. */
    REJECTED
}
