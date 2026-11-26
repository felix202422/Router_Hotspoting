package com.hotspot.repository;

import com.hotspot.domain.AdminRefreshToken;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminRefreshTokenRepository extends JpaRepository<AdminRefreshToken, Long> {

    Optional<AdminRefreshToken> findByTokenHash(String tokenHash);

    /** Revoke every live token of a rotation family (A2 reuse detection / logout). */
    @Modifying(clearAutomatically = true)
    @Query("update AdminRefreshToken t set t.revokedAt = :now where t.familyId = :familyId and t.revokedAt is null")
    int revokeFamily(@Param("familyId") UUID familyId, @Param("now") Instant now);

    @Modifying(clearAutomatically = true)
    @Query("update AdminRefreshToken t set t.revokedAt = :now where t.administrator.id = :adminId and t.revokedAt is null")
    int revokeAllForAdmin(@Param("adminId") Long adminId, @Param("now") Instant now);

    List<AdminRefreshToken> findByAdministratorIdAndRevokedAtIsNull(Long administratorId);
}
