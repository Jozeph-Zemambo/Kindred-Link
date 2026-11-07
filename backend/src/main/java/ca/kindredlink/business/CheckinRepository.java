package ca.kindredlink.business;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CheckinRepository extends JpaRepository<Checkin, Long> {

    interface BusinessCounts {
        Long getBusinessId();
        long getVisitors();
        long getKindnessActs();
    }

    /** Visitors = distinct devices that scanned; kindness acts = scans linked to a node. */
    @Query("select c.businessId as businessId, count(distinct c.deviceId) as visitors,"
            + " count(c.nodeId) as kindnessActs from Checkin c group by c.businessId")
    List<BusinessCounts> countsByBusiness();
}
