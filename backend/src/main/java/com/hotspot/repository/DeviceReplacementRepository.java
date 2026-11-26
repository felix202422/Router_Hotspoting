package com.hotspot.repository;

import com.hotspot.domain.DeviceReplacement;
import com.hotspot.domain.ReplacementStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceReplacementRepository extends JpaRepository<DeviceReplacement, Long> {

    List<DeviceReplacement> findByStatusOrderByCreatedAtDesc(ReplacementStatus status);

    List<DeviceReplacement> findAllByOrderByCreatedAtDesc();

    List<DeviceReplacement> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    long countByStatus(ReplacementStatus status);
}
