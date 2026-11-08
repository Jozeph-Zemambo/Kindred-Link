package ca.kindredlink.node;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NodeClaimRepository extends JpaRepository<NodeClaim, Long> {

    /** How many of this node's slots have been used (finished or not). */
    long countByNodeId(Long nodeId);

    /** This person's claim on this node, if they have one. */
    Optional<NodeClaim> findByNodeIdAndDeviceId(Long nodeId, String deviceId);
}
