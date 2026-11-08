package ca.kindredlink.business;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CheckinRepository extends JpaRepository<Checkin, Long> {

    interface BusinessCounts {
        Long getBusinessId();
        long getVisitors();
        long getKindnessActs();
        Instant getLastKindnessAt();
    }

    /**
     * Visitors = distinct devices that scanned; kindness acts = scans linked to a
     * node. lastKindnessAt is the createdAt of the newest LINKED checkin - the
     * moment the act happened at the business, not when the node was posted.
     */
    @Query("select c.businessId as businessId, count(distinct c.deviceId) as visitors,"
            + " count(c.nodeId) as kindnessActs,"
            + " max(case when c.nodeId is not null then c.createdAt else null end) as lastKindnessAt"
            + " from Checkin c group by c.businessId")
    List<BusinessCounts> countsByBusiness();
}
