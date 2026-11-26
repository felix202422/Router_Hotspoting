package com.hotspot.service;

import com.hotspot.common.ApiProblem;
import com.hotspot.common.AuditService;
import com.hotspot.common.RateLimitService;
import com.hotspot.domain.ActorType;
import com.hotspot.domain.AdminRefreshToken;
import com.hotspot.domain.AdminStatus;
import com.hotspot.domain.Administrator;
import com.hotspot.repository.AdminRefreshTokenRepository;
import com.hotspot.repository.AdministratorRepository;
import com.hotspot.security.JwtService;
import com.hotspot.security.JwtService.AdminClaim;
import com.hotspot.web.dto.AuthResponse;
import com.hotspot.web.dto.ProfileDto;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Admin authentication (contract A1–A4, NFR-03):
 * - A1 login: rate-limited 5/min per IP (contract §4), bcrypt verification,
 *   one identical error for unknown-email vs wrong-password (no enumeration),
 *   disabled accounts → 403. Issues a 15-min access token + a refresh token
 *   that starts a rotation family (V2 table, D-025).
 * - A2 refresh: rotation with reuse detection — presenting an already-rotated
 *   (revoked) token revokes the ENTIRE family and forces re-login.
 * - A3 logout: revokes the refresh family; idempotent (204 even for unknown
 *   or already-revoked tokens).
 * - A4 me: profile of the token's administrator (rejects disabled accounts).
 */
@Service
public class AdminAuthService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthService.class);

    /** Identical message for every credential failure (FR-C11-style, no enumeration). */
    private static final String GENERIC_AUTH_ERROR = "Invalid email or password.";

    private final AdministratorRepository administrators;
    private final AdminRefreshTokenRepository refreshTokens;
    private final JwtService jwt;
    private final RateLimitService rateLimiter;
    private final AuditService audit;
    /**
     * Revocations that must SURVIVE the 401/403 thrown right after them
     * (A2 reuse detection, disabled account): running them in the request's
     * transaction would roll them back with the exception — found by the
     * first smoke test, where a replayed token still worked after "reuse
     * detected". REQUIRES_NEW commits the revocation before the throw.
     */
    private final TransactionTemplate revokeTx;
    /** Same algorithm as BootstrapAdmin — BCrypt hashes embed their own cost/salt. */
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AdminAuthService(AdministratorRepository administrators,
                            AdminRefreshTokenRepository refreshTokens,
                            JwtService jwt,
                            RateLimitService rateLimiter,
                            AuditService audit,
                            PlatformTransactionManager transactionManager) {
        this.administrators = administrators;
        this.refreshTokens = refreshTokens;
        this.jwt = jwt;
        this.rateLimiter = rateLimiter;
        this.audit = audit;
        this.revokeTx = new TransactionTemplate(transactionManager);
        this.revokeTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** A1 — POST /admin/auth/login. */
    @Transactional
    public AuthResponse login(String email, String password, String ipAddress) {
        String bucket = "admin-login:" + ipAddress;
        RateLimitService.Decision decision = rateLimiter.tryAcquire(bucket, 5, Duration.ofMinutes(1));
        if (!decision.allowed()) {
            throw ApiProblem.tooManyRequests("Too many attempts",
                    "Too many login attempts. Please wait and try again.", decision.retryAfterSeconds());
        }

        Administrator admin = administrators.findByEmailIgnoreCase(email).orElse(null);
        if (admin == null || !encoder.matches(password, admin.getPasswordHash())) {
            throw ApiProblem.unauthorized(GENERIC_AUTH_ERROR);
        }
        if (admin.getStatus() != AdminStatus.ACTIVE) {
            throw ApiProblem.forbidden("This account has been disabled. Contact the owner.");
        }

        rateLimiter.reset(bucket); // one success clears the failure counter
        admin.setLastLoginAt(Instant.now());
        administrators.save(admin);

        String accessToken = jwt.issueAccessToken(admin);
        UUID familyId = UUID.randomUUID();
        String refreshToken = jwt.issueRefreshToken(admin, familyId, 0L);
        storeRefreshToken(admin, familyId, refreshToken, 0L);

        audit.record(ActorType.ADMIN, admin.getId(), "ADMIN_LOGIN", "administrator", admin.getId(),
                null, "Signed in", ipAddress);
        log.info("Admin login ok id={} ip={}", admin.getId(), ipAddress);
        return AuthResponse.of(admin, accessToken, refreshToken, jwt.getAccessTtl().getSeconds());
    }

    /** A2 — POST /admin/auth/refresh. Rotates the refresh token; reuse ⇒ family revoked. */
    @Transactional
    public AuthResponse refresh(String rawRefreshToken, String ipAddress) {
        JwtService.RefreshClaim claim = jwt.parseRefresh(rawRefreshToken);
        if (claim == null) {
            throw ApiProblem.unauthorized(GENERIC_AUTH_ERROR);
        }
        AdminRefreshToken row = refreshTokens.findByTokenHash(JwtService.sha256Hex(rawRefreshToken))
                .orElse(null);
        if (row == null || claim.uid() != row.getAdministrator().getId()) {
            // validly-signed but unknown token (e.g. DB purged) → same generic failure
            throw ApiProblem.unauthorized(GENERIC_AUTH_ERROR);
        }
        if (row.isRevoked()) {
            // REUSE DETECTED (A2): a rotated token came back — kill the family.
            // Own transaction: the 401 below would otherwise roll this back.
            revokeTx.executeWithoutResult(status ->
                    refreshTokens.revokeFamily(row.getFamilyId(), Instant.now()));
            audit.record(ActorType.ADMIN, row.getAdministrator().getId(), "ADMIN_REFRESH_REUSE_DETECTED",
                    "administrator", row.getAdministrator().getId(), null,
                    "Refresh token reuse — rotation family revoked", ipAddress);
            log.warn("Refresh-token reuse detected for admin {} — family {} revoked",
                    row.getAdministrator().getId(), row.getFamilyId());
            throw ApiProblem.unauthorized(GENERIC_AUTH_ERROR);
        }
        if (row.getExpiresAt().isBefore(Instant.now())) {
            throw ApiProblem.unauthorized(GENERIC_AUTH_ERROR);
        }

        Administrator admin = row.getAdministrator();
        if (admin.getStatus() != AdminStatus.ACTIVE) {
            // own transaction: the 403 below would otherwise roll this back
            revokeTx.executeWithoutResult(status ->
                    refreshTokens.revokeFamily(row.getFamilyId(), Instant.now()));
            throw ApiProblem.forbidden("This account has been disabled. Contact the owner.");
        }

        // Rotate: current token → revoked, next seq in the SAME family.
        row.setRevokedAt(Instant.now());
        refreshTokens.save(row);
        long nextSeq = row.getSeq() + 1;
        String newRefreshToken = jwt.issueRefreshToken(admin, row.getFamilyId(), nextSeq);
        storeRefreshToken(admin, row.getFamilyId(), newRefreshToken, nextSeq);

        String accessToken = jwt.issueAccessToken(admin);
        return AuthResponse.of(admin, accessToken, newRefreshToken, jwt.getAccessTtl().getSeconds());
    }

    /** A3 — POST /admin/auth/logout. Idempotent: unknown/revoked tokens still succeed. */
    @Transactional
    public void logout(String rawRefreshToken, String ipAddress) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokens.findByTokenHash(JwtService.sha256Hex(rawRefreshToken)).ifPresent(row -> {
            if (!row.isRevoked()) {
                refreshTokens.revokeFamily(row.getFamilyId(), Instant.now());
                audit.record(ActorType.ADMIN, row.getAdministrator().getId(), "ADMIN_LOGOUT",
                        "administrator", row.getAdministrator().getId(), null,
                        "Refresh family revoked", ipAddress);
            }
        });
    }

    /** A4 — GET /admin/auth/me. Principal comes from the JWT filter. */
    @Transactional(readOnly = true)
    public ProfileDto me(AdminClaim claim) {
        Administrator admin = administrators.findById(claim.uid())
                .orElseThrow(() -> ApiProblem.unauthorized(GENERIC_AUTH_ERROR));
        if (admin.getStatus() != AdminStatus.ACTIVE) {
            throw ApiProblem.unauthorized("This account has been disabled. Contact the owner.");
        }
        return ProfileDto.from(admin);
    }

    private void storeRefreshToken(Administrator admin, UUID familyId, String rawToken, long seq) {
        AdminRefreshToken row = new AdminRefreshToken();
        row.setAdministrator(admin);
        row.setTokenHash(JwtService.sha256Hex(rawToken)); // raw never persisted (D-012)
        row.setFamilyId(familyId);
        row.setSeq(seq);
        row.setExpiresAt(Instant.now().plus(jwt.getRefreshTtl()));
        refreshTokens.save(row);
    }
}
