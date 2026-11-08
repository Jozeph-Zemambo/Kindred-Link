package ca.kindredlink.photo;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Saves and loads photos. Spring writes the implementation (save, findById and so on).
 * The extra queries below return only small fields (never the image bytes), so listing many
 * nodes doesn't drag every picture out of the database.
 */
public interface NodePhotoRepository extends JpaRepository<NodePhoto, Long> {

    /** Just the id and status of a photo (no image bytes). */
    interface PhotoRef {
        Long getId();

        PhotoStatus getStatus();
    }

    /** The photo attached to this node, if any. */
    @Query("select p.id as id, p.status as status from NodePhoto p where p.nodeId = :nodeId")
    Optional<PhotoRef> findRefByNodeId(Long nodeId);

    /** Of these nodes, the ids of the ones whose photo has the given status. One query for a whole map. */
    @Query("select p.nodeId from NodePhoto p where p.nodeId in :nodeIds and p.status = :status")
    List<Long> findNodeIdsByStatus(Collection<Long> nodeIds, PhotoStatus status);

    /** A photo waiting in the moderation queue, without its bytes. */
    interface PendingPhoto {
        Long getId();

        Long getNodeId();

        Instant getCreatedAt();
    }

    /** Photos with the given status, oldest first. Used for the moderator's queue. */
    @Query("select p.id as id, p.nodeId as nodeId, p.createdAt as createdAt from NodePhoto p"
            + " where p.status = :status order by p.createdAt")
    List<PendingPhoto> findQueue(PhotoStatus status);
}
