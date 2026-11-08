package ca.kindredlink.auth;

/** Server-verified identity, never a client-supplied X-Device-Id header. */
public record AuthenticatedAccount(Long id) {
    // Compatibility with existing authorDeviceId / reservedByDeviceId database columns.
    public String identity() { return "account:" + id; }
}
