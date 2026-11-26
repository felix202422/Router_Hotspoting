package com.hotspot.repository;

import com.hotspot.domain.SmsNotification;
import com.hotspot.domain.SmsStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SmsNotificationRepository extends JpaRepository<SmsNotification, Long> {

    /** Retry worker pulls queued/failed rows oldest-first (FR-T02). */
    List<SmsNotification> findByStatusOrderByCreatedAtAsc(SmsStatus status);

    long countByStatus(SmsStatus status);
}
