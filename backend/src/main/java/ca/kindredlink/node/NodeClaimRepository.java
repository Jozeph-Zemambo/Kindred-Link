package ca.kindredlink.node;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface NodeClaimRepository extends JpaRepository<NodeClaim, Long> {

    /** How many of this node's slots have been used (finished or not). */
    long countByNodeId(Long nodeId);

    /** This person's claim on this node, if they have one. */
    Optional<NodeClaim> findByNodeIdAndDeviceId(Long nodeId, String deviceId);

    /** One row per node: how many claims it has. Lets us fill in many map pins with one query. */
    interface ClaimCount {
        Long getNodeId();

        long getCount();
    }

    /** Claim counts for a whole list of nodes at once (nodes with no claims are simply missing). */
    @Query("select c.nodeId as nodeId, count(c) as count from NodeClaim c where c.nodeId in :nodeIds group by c.nodeId")
    List<ClaimCount> countClaims(Collection<Long> nodeIds);
}
