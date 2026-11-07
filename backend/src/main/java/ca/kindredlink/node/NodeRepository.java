package ca.kindredlink.node;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface NodeRepository extends JpaRepository<KindnessNode, Long> {

    /** Row lock so two people continuing the same node at once can't both take the last slot. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from KindnessNode n where n.id = :id")
    Optional<KindnessNode> findByIdForUpdate(Long id);

    List<KindnessNode> findByChainIdOrderByCreatedAtAsc(Long chainId);

    List<KindnessNode> findByParentIdOrderByCreatedAtAsc(Long parentId);

    long countByParentId(Long parentId);

    List<KindnessNode> findByAuthorDeviceIdOrderByCreatedAtDesc(String authorDeviceId);

    /** Bounding-box prefilter on the public coordinates; the service trims to a true radius. */
    List<KindnessNode> findByApproxLatBetweenAndApproxLngBetween(
            double minLat, double maxLat, double minLng, double maxLng);

    interface ChildCount {
        Long getParentId();
        long getCount();
    }

    @Query("select n.parentId as parentId, count(n) as count from KindnessNode n"
            + " where n.parentId in :parentIds group by n.parentId")
    List<ChildCount> countChildren(Collection<Long> parentIds);
}
