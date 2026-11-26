package com.hotspot.repository;

import com.hotspot.domain.Subscription;
import com.hotspot.domain.SubscriptionStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long>, JpaSpecificationExecutor<Subscription> {

    List<Subscription> findByCustomerId(Long customerId);

    Optional<Subscription> findFirstByCustomerIdAndStatusOrderByEndsAtDesc(Long customerId, SubscriptionStatus status);

    /** Expiry sweep (§4.2) — row lock makes concurrent sweeps safe. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Subscription s where s.status = :status and s.endsAt <= :now")
    List<Subscription> findExpiredActiveForSweep(@Param("status") SubscriptionStatus status, @Param("now") Instant now);

    long countByStatus(SubscriptionStatus status);

    long countByStatusAndEndsAtAfter(SubscriptionStatus status, Instant after);

    List<Subscription> findByStatusAndEndsAtBetween(SubscriptionStatus status, Instant from, Instant to);
}
