package ca.kindredlink.photo;

import org.springframework.data.jpa.repository.JpaRepository;

/** Saves and loads photos. Spring writes the implementation (save, findById and so on). */
public interface NodePhotoRepository extends JpaRepository<NodePhoto, Long> {
}
