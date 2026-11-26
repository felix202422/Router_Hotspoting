package com.hotspot.repository;

import com.hotspot.domain.ActiveSession;
import com.hotspot.domain.EndReason;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActiveSessionRepository extends JpaRepository<ActiveSession, Long> {

    List<ActiveSession> findByEndedAtIsNull();

    Optional<ActiveSession> findByControllerSessionId(String controllerSessionId);

    Optional<ActiveSession> findFirstBySubscriptionIdAndEndedAtIsNull(Long subscriptionId);

    long countByEndedAtIsNull();

    List<ActiveSession> findBySubscriptionIdOrderByStartedAtDesc(Long subscriptionId);

    @Modifying(clearAutomatically = true)
    @Query("update ActiveSession s set s.endedAt = :now, s.endReason = :reason "
            + "where s.subscription.id = :subscriptionId and s.endedAt is null")
    int endLiveSessions(@Param("subscriptionId") Long subscriptionId,
                        @Param("reason") EndReason reason,
                        @Param("now") Instant now);

    /** A29: end the DB mirror of a controller-side disconnect (no context clear, D-031). */
    @Modifying(flushAutomatically = true)
    @Query("update ActiveSession s set s.endedAt = :now, s.endReason = :reason "
            + "where s.controllerSessionId = :grantRef and s.endedAt is null")
    int endByGrantRef(@Param("grantRef") String grantRef,
                      @Param("reason") EndReason reason,
                      @Param("now") Instant now);
}
