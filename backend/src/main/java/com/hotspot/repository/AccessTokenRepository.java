package com.hotspot.repository;

import com.hotspot.domain.AccessToken;
import com.hotspot.domain.TokenStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccessTokenRepository extends JpaRepository<AccessToken, Long> {

    Optional<AccessToken> findByTokenHash(String tokenHash);

    List<AccessToken> findBySubscriptionIdAndStatus(Long subscriptionId, TokenStatus status);

    /**
     * FR-A03 rotation helper: revoke every ACTIVE token of a subscription.
     * Flush but DO NOT clear: clearing detaches the Customer/Subscription entities
     * held by the caller (activation passes them to the controller + SMS steps),
     * which caused LazyInitializationException after every verified payment.
     */
    @Modifying(flushAutomatically = true)
    @Query("update AccessToken t set t.status = :newStatus, t.revokedAt = :now, t.rawTokenCipher = null "
            + "where t.subscription.id = :subscriptionId and t.status = :activeStatus")
    int updateStatusForSubscription(@Param("subscriptionId") Long subscriptionId,
                                    @Param("newStatus") TokenStatus newStatus,
                                    @Param("activeStatus") TokenStatus activeStatus,
                                    @Param("now") Instant now);
}
