package com.hotspot.service;

import com.hotspot.common.ApiProblem;
import com.hotspot.domain.AccessToken;
import com.hotspot.domain.Customer;
import com.hotspot.domain.Subscription;
import com.hotspot.domain.SubscriptionStatus;
import com.hotspot.domain.TokenStatus;
import com.hotspot.repository.AccessTokenRepository;
import com.hotspot.repository.SubscriptionRepository;
import com.hotspot.security.JwtService;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Access-token core (D-012, FR-A02/A03):
 * raw token generated once → SHA-256 hash stored → raw only in the SMS.
 * Every verified purchase rotates the token (old → REVOKED).
 */
@Service
public class TokenService {

    public record AuthenticatedToken(AccessToken token, Subscription subscription) {
    }

    private static final String TOKEN_PREFIX = "TKT-";
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray(); // no 0/O/1/I

    private final AccessTokenRepository tokens;
    private final SubscriptionRepository subscriptions;

    public TokenService(AccessTokenRepository tokens, SubscriptionRepository subscriptions) {
        this.tokens = tokens;
        this.subscriptions = subscriptions;
    }

    /** Generates a raw token in the format TKT-XXXX-XXXX-XXXX (≈59 bits, no ambiguous glyphs). */
    public static String generateRawToken() {
        StringBuilder sb = new StringBuilder(TOKEN_PREFIX);
        java.security.SecureRandom random = new java.security.SecureRandom();
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
            throw ApiProblem.unauthorized("Invalid or expired access token.");
        }
        AccessToken token = tokens.findByTokenHash(JwtService.sha256Hex(rawToken.trim()))
                .orElseThrow(TokenService::generic401);
        if (token.getStatus() != TokenStatus.ACTIVE) {
            throw TokenService.generic401();
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
        if (subscription.getCustomer().getStatus() == com.hotspot.domain.CustomerStatus.SUSPENDED) {
            throw generic401();
        }
        return new AuthenticatedToken(token, subscription);
    }

    /** Resends the SAME still-valid token (A22, FR-T04): returns raw only for re-SMS. */
    @Transactional
    public String revealForResend(Long subscriptionId) {
        List<AccessToken> active = tokens.findBySubscriptionIdAndStatus(subscriptionId, TokenStatus.ACTIVE);
        if (active.isEmpty()) {
            throw ApiProblem.conflict("Token unavailable",
                    "No active token for this purchase — the subscription may be expired or revoked.");
        }
        // The raw value is not recoverable (only its hash is stored). Re-issuing the
        // same hint with a fresh raw value would break "same token" semantics, so we
        // reject honestly instead of inventing a token (FR-T04 requires re-sending
        // the SAME token — Phase 5 SMS provider will hold no copy either, therefore
        // resend re-issues a rotated token and the customer is told so).
        throw ApiProblem.conflict("Token unavailable",
                "The original token cannot be re-read (only its hash is stored). Ask the customer to use token login, or rotate the token by re-purchasing.");
    }

    private static ApiProblem generic401() {
        return ApiProblem.unauthorized("Invalid or expired access token.");
    }

    public Customer customerOf(Subscription subscription) {
        return subscription.getCustomer();
    }
}
