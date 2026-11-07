package ca.kindredlink.common;

/**
 * There are no accounts yet. Each install generates a random id and sends it as this header,
 * which is enough to answer "which nodes are mine". Swap for real auth later.
 */
public final class DeviceId {
    public static final String HEADER = "X-Device-Id";

    private DeviceId() {}
}
