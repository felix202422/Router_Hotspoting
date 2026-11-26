package com.hotspot.service;

import com.hotspot.common.ApiProblem;
import com.hotspot.domain.AccessToken;
import com.hotspot.domain.Customer;
import com.hotspot.domain.CustomerStatus;
import com.hotspot.domain.Subscription;
import com.hotspot.domain.SubscriptionStatus;
import com.hotspot.domain.TokenStatus;
import com.hotspot.repository.AccessTokenRepository;
import com.hotspot.repository.SubscriptionRepository;
import com.hotspot.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Access-token core (D-012, FR-A02/A03/A04):
 * raw token generated once → SHA-256 hash stored → raw only in the SMS.
 * Every verified purchase rotates the token (old → REVOKED).
 * D-028: an AES-GCM escrow copy of the ACTIVE raw token enables A22 "resend the
 * SAME token" without weakening the hash-only storage of revoked tokens.
 */
@Service
public class TokenService {

    public record AuthenticatedToken(AccessToken token, Subscription subscription) {
    }

    private static final Logger log = LoggerFactory.getLogger(TokenService.class);
    private static final String TOKEN_PREFIX = "TKT-";
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray(); // no 0/O/1/I
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;

    private final AccessTokenRepository tokens;
    private final SubscriptionRepository subscriptions;
    /** null when TOKEN_ESCROW_KEY is unset: resend then honestly returns 409. */
    private final SecretKeySpec escrowKey;

    public TokenService(AccessTokenRepository tokens,
                        SubscriptionRepository subscriptions,
                        @Value("${app.security.token-escrow-key:}") String escrowKeyConfig) {
        this.tokens = tokens;
        this.subscriptions = subscriptions;
        if (escrowKeyConfig == null || escrowKeyConfig.isBlank()) {
            this.escrowKey = null;
            log.warn("TOKEN_ESCROW_KEY not set — A22 resend-token cannot re-read raw tokens (409). "
                    + "Set it in the environment to enable encrypted escrow.");
        } else {
            try {
                byte[] key = MessageDigest.getInstance("SHA-256")
                        .digest(escrowKeyConfig.getBytes(StandardCharsets.UTF_8));
                this.escrowKey = new SecretKeySpec(key, "AES");
            } catch (Exception e) {
                throw new IllegalStateException("Cannot initialise token escrow key", e);
            }
        }
    }

    /** Generates a raw token in the format TKT-XXXX-XXXX-XXXX (≈59 bits, no ambiguous glyphs). */
    public static String generateRawToken() {
        StringBuilder sb = new StringBuilder(TOKEN_PREFIX);
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 12; i++) {
            if (i > 0 && i % 4 == 0) {
                sb.append('-');
            }
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }

    /**
     * FR-A03 rotation: revokes every ACTIVE token of the subscription, issues a
     * new one and returns the RAW value (caller sends it by SMS and discards it).
     */
    @Transactional
    public String rotate(Subscription subscription, Instant expiresAt) {
        Instant now = Instant.now();
        tokens.updateStatusForSubscription(subscription.getId(), TokenStatus.REVOKED, TokenStatus.ACTIVE, now);

        String raw = generateRawToken();
        AccessToken token = new AccessToken();
        token.setSubscription(subscription);
        token.setTokenHash(JwtService.sha256Hex(raw));
        token.setTokenHint(raw.substring(raw.length() - 4));
        token.setStatus(TokenStatus.ACTIVE);
        token.setIssuedAt(now);
        token.setExpiresAt(expiresAt);
        token.setRawTokenCipher(encrypt(raw)); // D-028: only when the env key exists
        tokens.save(token);
        return raw;
    }

    /**
     * Validates a raw portal token (P5/P6/P7) with GENERIC failures (FR-C11):
     * invalid / revoked / expired / suspended all surface the same 401 detail.
     * Device mismatch is the only specific error (contract P5 → 409).
     */
    public AuthenticatedToken validate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw generic401();
        }
        AccessToken token = tokens.findByTokenHash(JwtService.sha256Hex(rawToken.trim()))
                .orElseThrow(TokenService::generic401);
        if (token.getStatus() != TokenStatus.ACTIVE) {
            throw generic401();
        }
        Subscription subscription = subscriptions.findById(token.getSubscription().getId())
                .orElseThrow(TokenService::generic401);

        if (subscription.getStatus() == SubscriptionStatus.SUSPENDED) {
            // Suspended is reported generically too — no state disclosure (FR-C11).
            throw generic401();
        }
        if (subscription.getStatus() != SubscriptionStatus.ACTIVE
                || !subscription.getEndsAt().isAfter(Instant.now())) {
            throw generic401();
        }
        if (subscription.getCustomer().getStatus() == CustomerStatus.SUSPENDED) {
            throw generic401();
        }
        return new AuthenticatedToken(token, subscription);
    }

    /**
     * A22 (FR-T04, D-028): re-send the SAME still-valid token. Only an ACTIVE
     * escrow copy can be decrypted; revoked/expired tokens are hash-only → 409.
     * Returns the raw value to the caller solely for SMS dispatch — never in an
     * HTTP response and never logged.
     */
    @Transactional(readOnly = true)
    public String revealForResend(Long subscriptionId) {
        AccessToken token = tokens.findBySubscriptionIdAndStatus(subscriptionId, TokenStatus.ACTIVE)
                .stream().findFirst().orElse(null);
        if (token == null || token.getRawTokenCipher() == null || escrowKey == null) {
            throw tokenUnavailable();
        }
        Subscription subscription = subscriptions.findById(subscriptionId).orElseThrow(TokenService::tokenUnavailable);
        if (subscription.getStatus() != SubscriptionStatus.ACTIVE
                || !subscription.getEndsAt().isAfter(Instant.now())
                || subscription.getCustomer().getStatus() == CustomerStatus.SUSPENDED) {
            throw tokenUnavailable();
        }
        String raw = decrypt(token.getRawTokenCipher());
        if (raw == null || !JwtService.sha256Hex(raw).equals(token.getTokenHash())) {
            // Cipher/key mismatch: fail closed, never invent or rotate a "same" token.
            log.error("Token escrow integrity check failed for token {}", token.getId());
            throw tokenUnavailable();
        }
        return raw;
    }

    private String encrypt(String raw) {
        if (escrowKey == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, escrowKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(raw.getBytes(StandardCharsets.UTF_8));
            byte[] payload = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Token escrow encryption failed", e);
        }
    }

    private String decrypt(String cipherText) {
        try {
            byte[] payload = Base64.getDecoder().decode(cipherText);
            if (payload.length <= IV_BYTES) {
                return null;
            }
            byte[] iv = java.util.Arrays.copyOf(payload, IV_BYTES);
            byte[] encrypted = java.util.Arrays.copyOfRange(payload, IV_BYTES, payload.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, escrowKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("Token escrow decryption failed: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    private static ApiProblem tokenUnavailable() {
        return ApiProblem.conflict("Token unavailable",
                "No active token for this purchase — the subscription may be expired or revoked.");
    }

    private static ApiProblem generic401() {
        // Contract P5: identical title for invalid, revoked, expired, suspended —
        // never reveal which check failed (FR-C11).
        String message = "Invalid or expired access token";
        return ApiProblem.unauthorized(message, message);
    }

    public Customer customerOf(Subscription subscription) {
        return subscription.getCustomer();
    }
}
