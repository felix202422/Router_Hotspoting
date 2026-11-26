package com.hotspot.security;

import com.hotspot.domain.Administrator;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * JWT issuing/parsing (admin auth, api-contract §1 + A1/A2).
 * The signing secret comes ONLY from the JWT_SECRET env var; when it is absent
 * (local dev) a random secret is generated so nothing secret is ever committed
 * (master rule 6) — dev tokens then simply die on restart.
 */
@Service
public class JwtService {

    public record AdminClaim(long uid, String email, String role) {
    }

    public record AccessClaim(AdminClaim admin) {
    }

    public record RefreshClaim(UUID familyId, long seq, long uid, String email) {
    }

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey key;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtService(
            @Value("${app.jwt.secret:}") String secret,
            @Value("${app.jwt.access-ttl-minutes:15}") long accessTtlMinutes,
            @Value("${app.jwt.refresh-ttl-days:30}") long refreshTtlDays) {
        byte[] raw;
        if (secret == null || secret.isBlank()) {
            raw = new byte[64];
            new SecureRandom().nextBytes(raw);
            log.warn("JWT_SECRET not set — generated an ephemeral signing secret for this process. "
                    + "Set JWT_SECRET in the environment for production.");
        } else {
            raw = secret.getBytes(StandardCharsets.UTF_8);
            if (raw.length < 32) {
                throw new IllegalStateException("JWT_SECRET must be at least 32 bytes (use: openssl rand -base64 48)");
            }
        }
        this.key = Keys.hmacShaKeyFor(raw);
        this.accessTtl = Duration.ofMinutes(accessTtlMinutes);
        this.refreshTtl = Duration.ofDays(refreshTtlDays);
    }

    public Duration getAccessTtl() {
        return accessTtl;
    }

    public Duration getRefreshTtl() {
        return refreshTtl;
    }

    /** Short-lived access token (15 min) — role claim = RBAC source. */
    public String issueAccessToken(Administrator admin) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(admin.getEmail())
                .id(String.valueOf(admin.getId()))
                .claim("role", admin.getRole().name())
                .claim("typ", "access")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** Refresh token for a rotation family (A2). Raw value returned once; hash stored. */
    public String issueRefreshToken(Administrator admin, UUID familyId, long seq) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(admin.getEmail())
                .id(UUID.randomUUID().toString())
                .claim("uid", admin.getId())
                .claim("fam", familyId.toString())
                .claim("seq", seq)
                .claim("typ", "refresh")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(refreshTtl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** Parses a token that must be an access token. Returns null when invalid/expired. */
    public AdminClaim parseAccess(String token) {
        Claims claims = parse(token);
        if (claims == null || !"access".equals(claims.get("typ", String.class))) {
            return null;
        }
        try {
            // access tokens carry the administrator id as the jti claim
            long uid = Long.parseLong(claims.getId());
            return new AdminClaim(uid, claims.getSubject(), claims.get("role", String.class));
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Parses a token that must be a refresh token. Returns null when invalid/expired. */
    public RefreshClaim parseRefresh(String token) {
        Claims claims = parse(token);
        if (claims == null || !"refresh".equals(claims.get("typ", String.class))) {
            return null;
        }
        try {
            return new RefreshClaim(
                    UUID.fromString(claims.get("fam", String.class)),
                    claims.get("seq", Long.class),
                    claims.get("uid", Long.class),
                    claims.getSubject());
        } catch (RuntimeException e) {
            return null;
        }
    }

    private Claims parse(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /** SHA-256 hex — used for refresh-token storage (raw never persisted, D-012). */
    public static String sha256Hex(String value) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** URL-safe random token material (portal access tokens, purchase refs). */
    public static String randomToken(int bytes) {
        byte[] raw = new byte[bytes];
        new SecureRandom().nextBytes(raw);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }
}
