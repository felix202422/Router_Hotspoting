package com.hotspot.service;

import com.hotspot.common.ApiProblem;
import com.hotspot.common.AuditService;
import com.hotspot.domain.AccessToken;
import com.hotspot.domain.ActiveSession;
import com.hotspot.domain.Customer;
import com.hotspot.domain.DeviceStatus;
import com.hotspot.domain.EndReason;
import com.hotspot.domain.Payment;
import com.hotspot.domain.Subscription;
import com.hotspot.domain.SubscriptionStatus;
import com.hotspot.domain.TokenStatus;
import com.hotspot.integration.hotspot.GrantRequest;
import com.hotspot.integration.hotspot.GrantResult;
import com.hotspot.integration.hotspot.HotspotController;
import com.hotspot.repository.AccessTokenRepository;
import com.hotspot.repository.ActiveSessionRepository;
import com.hotspot.repository.RegisteredDeviceRepository;
import com.hotspot.repository.SubscriptionRepository;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Subscription lifecycle — the D-007 extension heart and the single place
 * where tokens/grants/SMS are applied when a verified payment activates access
 * (system-architecture §4.1, all inside ONE transaction; a controller failure
 * is logged and surfaced as drift for reconciliation — it never blocks commit).
 */
@Service
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);
    private static final DateTimeFormatter EAT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm").withZone(ZoneId.of("Africa/Dar_es_Salaam"));

    private final SubscriptionRepository subscriptions;
    private final RegisteredDeviceRepository devices;
    private final ActiveSessionRepository sessions;
    private final AccessTokenRepository tokens;
    private final TokenService tokenService;
    private final SmsService smsService;
    private final HotspotController controller;
    private final AuditService audit;

    public SubscriptionService(SubscriptionRepository subscriptions,
                               RegisteredDeviceRepository devices,
                               ActiveSessionRepository sessions,
                               AccessTokenRepository tokens,
                               TokenService tokenService,
                               SmsService smsService,
                               HotspotController controller,
                               AuditService audit) {
        this.subscriptions = subscriptions;
        this.devices = devices;
        this.sessions = sessions;
        this.tokens = tokens;
        this.tokenService = tokenService;
        this.smsService = smsService;
        this.controller = controller;
        this.audit = audit;
    }

    /**
     * VERIFIED payment → activate or extend (D-007: remaining time preserved,
     * new duration appended). Callers guard on payment.status == PENDING, so
     * this runs exactly once per payment (idempotency anchor = payment row).
     */
    @Transactional
    public Subscription activateOrExtend(Payment payment, Customer customer) {
        Instant now = Instant.now();
        Subscription subscription = subscriptions
                .findFirstByCustomerIdAndStatusOrderByEndsAtDesc(customer.getId(), SubscriptionStatus.ACTIVE)
                .filter(s -> s.getEndsAt().isAfter(now))
                .map(existing -> extend(existing, payment, now))
                .orElseGet(() -> createNew(customer, payment, now));

        if (payment.getActivatedSubscription() == null) {
            payment.setActivatedSubscription(subscription);
        }

        // 1) rotate token (FR-A03) — raw value exists only for the SMS below
        String rawToken = tokenService.rotate(subscription, subscription.getEndsAt());

        // 2) grant on the controller (failure logged → drift; never blocks payment)
        applyGrant(subscription, customer, payment);

        // 3) SMS: token + confirmation (only redacted bodies are persisted)
        smsService.sendToken(customer, subscription, rawToken, payment.getPkg().getName());
        smsService.sendPaymentConfirmation(customer, subscription, payment.getAmountTzs(),
                payment.getPkg().getName(), EAT.format(subscription.getEndsAt()));

        audit.recordSystem("SUBSCRIPTION_ACTIVATE", "subscription", subscription.getId(),
                "Payment " + payment.getIdempotencyKey() + " activated/extended subscription for "
                        + customer.getPhoneE164());
        return subscription;
    }

    /** D-007: new endsAt = max(now, current endsAt) + package duration. */
    private Subscription extend(Subscription existing, Payment payment, Instant now) {
        Instant base = existing.getEndsAt().isAfter(now) ? existing.getEndsAt() : now;
        existing.setEndsAt(base.plusSeconds(payment.getPkg().getDurationSeconds()));
        existing.setExtensionCount(existing.getExtensionCount() + 1);
        existing.setPkg(payment.getPkg());      // latest purchase defines current limits
        existing.setPayment(payment);
        existing.setStatus(SubscriptionStatus.ACTIVE);
        existing.setActivatedAt(now);
        existing.setSuspendedReason(null);
        return subscriptions.save(existing);
    }

    private Subscription createNew(Customer customer, Payment payment, Instant now) {
        Subscription subscription = new Subscription();
        subscription.setCustomer(customer);
        subscription.setPkg(payment.getPkg());
        subscription.setPayment(payment);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartsAt(now);
        subscription.setEndsAt(now.plusSeconds(payment.getPkg().getDurationSeconds()));
        subscription.setActivatedAt(now);
        subscription.setExtensionCount(0);
        return subscriptions.save(subscription);
    }

    private void applyGrant(Subscription subscription, Customer customer, Payment payment) {
        try {
            com.hotspot.domain.Package pkg = subscription.getPkg();
            GrantResult result = controller.grantAccess(new GrantRequest(
                    subscription.getId(),
                    customer.getPhoneE164(),
                    subscription.getEndsAt(),
                    pkg.getMaxDownloadKbps(),
                    pkg.getMaxUploadKbps(),
                    pkg.getDeviceLimit()));
            if (result.ok()) {
                if (sessions.findByControllerSessionId(result.grantRef()).isEmpty()) {
                    ActiveSession row = new ActiveSession();
                    row.setSubscription(subscription);
                    row.setControllerSessionId(result.grantRef());
                    // Client IP unknown until Phase 5 MikroTik sync — store NULL,
                    // never a placeholder (FR-D06 "never fabricated", audit KI-6).
                    row.setIpAddress(null);
                    row.setStartedAt(Instant.now());
                    sessions.save(row);
                }
            } else {
                log.warn("Grant failed for subscription {} — enforcement pending: {}",
                        subscription.getId(), result.error());
            }
        } catch (RuntimeException e) {
            log.error("Controller grant error for subscription {}", subscription.getId(), e);
        }
    }

    /** Suspend (A19): revokes token + grant + device binding; reversible by resume. */
    @Transactional
    public void suspend(Subscription subscription, String reason) {
        subscription.setStatus(SubscriptionStatus.SUSPENDED);
        subscription.setSuspendedReason(reason);
        subscriptions.save(subscription);
        cutAccess(subscription, EndReason.REVOKE, Instant.now());
        audit.recordSystem("SUBSCRIPTION_SUSPEND", "subscription", subscription.getId(), reason);
    }

    /**
     * Resume (A8/A19): only while the purchased time is still valid. Suspend
     * revoked the token/grant, so a real resume MUST issue a fresh token, grant
     * and token SMS — otherwise the customer would be "ACTIVE" without access.
     */
    @Transactional
    public void resume(Subscription subscription) {
        if (!subscription.getEndsAt().isAfter(Instant.now())) {
            throw ApiProblem.unprocessable("Cannot resume",
                    "Subscription already expired — customer must purchase again.");
        }
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setSuspendedReason(null);
        subscriptions.save(subscription);

        Customer customer = subscription.getCustomer();
        String rawToken = tokenService.rotate(subscription, subscription.getEndsAt());
        applyGrant(subscription, customer, subscription.getPayment());
        smsService.sendToken(customer, subscription, rawToken, subscription.getPkg().getName());
        audit.recordSystem("SUBSCRIPTION_RESUME", "subscription", subscription.getId(), "Resumed");
    }

    /** Permanent revoke (A20): token + grant gone; financial history untouched (NFR-06). */
    @Transactional
    public void revoke(Subscription subscription) {
        subscription.setStatus(SubscriptionStatus.SUSPENDED);
        subscription.setSuspendedReason("Token revoked by administrator");
        subscriptions.save(subscription);
        cutAccess(subscription, EndReason.REVOKE, Instant.now());
        audit.recordSystem("SUBSCRIPTION_REVOKE", "subscription", subscription.getId(), "Revoked");
    }

    /** Ends the live session + controller grant (A12/A29 force-disconnect). */
    @Transactional
    public void disconnect(Subscription subscription, EndReason reason) {
        cutAccess(subscription, reason, Instant.now());
    }

    /** Terminal actions: revoke ACTIVE token, end live session, unbind device, drop grant. */
    private void cutAccess(Subscription subscription, EndReason reason, Instant now) {
        tokens.updateStatusForSubscription(subscription.getId(), TokenStatus.REVOKED, TokenStatus.ACTIVE, now);
        sessions.endLiveSessions(subscription.getId(), reason, now);
        devices.unbindDevices(subscription.getId(), DeviceStatus.REMOVED, DeviceStatus.ACTIVE, now);
        try {
            controller.revokeAccess("grant_" + subscription.getId());
        } catch (RuntimeException e) {
            log.error("Controller revoke failed for subscription {}", subscription.getId(), e);
        }
    }

    public List<Subscription> activeForCustomer(Long customerId) {
        return subscriptions.findByCustomerId(customerId).stream()
                .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE && s.getEndsAt().isAfter(Instant.now()))
                .toList();
    }

    /** Exposed for the expiry sweep (TokenService-style revoke with EXPIRED status). */
    @Transactional
    public void markExpired(Subscription subscription, Instant now) {
        subscription.setStatus(SubscriptionStatus.EXPIRED);
        subscriptions.save(subscription);
        tokens.updateStatusForSubscription(subscription.getId(), TokenStatus.EXPIRED, TokenStatus.ACTIVE, now);
        sessions.endLiveSessions(subscription.getId(), EndReason.EXPIRED, now);
        devices.unbindDevices(subscription.getId(), DeviceStatus.REMOVED, DeviceStatus.ACTIVE, now);
        try {
            controller.revokeAccess("grant_" + subscription.getId());
        } catch (RuntimeException e) {
            log.error("Controller revoke failed (expiry) for subscription {}", subscription.getId(), e);
        }
        audit.recordSystem("SUBSCRIPTION_EXPIRE", "subscription", subscription.getId(),
                "Expired and access revoked");
    }

    /** True when the subscription currently has a live device session. */
    public boolean hasLiveSession(Subscription subscription) {
        return sessions.findFirstBySubscriptionIdAndEndedAtIsNull(subscription.getId()).isPresent();
    }

    /**
     * P5 reconnect: ensures a live controller-backed session exists, returning
     * the time it was established. Existing live sessions are reused; a new
     * grant goes through the SAME controller SPI as activation (D-010) — no
     * made-up session state (FR-D06). If the controller refuses the grant the
     * customer is told honestly instead of being shown a fake "CONNECTED".
     */
    @Transactional
    public Instant ensureLiveSession(Subscription subscription) {
        Instant now = Instant.now();
        var existing = sessions.findFirstBySubscriptionIdAndEndedAtIsNull(subscription.getId());
        if (existing.isPresent()) {
            return existing.get().getStartedAt();
        }

        Customer customer = subscription.getCustomer();
        com.hotspot.domain.Package pkg = subscription.getPkg();
        GrantResult result;
        try {
            result = controller.grantAccess(new GrantRequest(subscription.getId(),
                    customer.getPhoneE164(), subscription.getEndsAt(),
                    pkg.getMaxDownloadKbps(), pkg.getMaxUploadKbps(), pkg.getDeviceLimit()));
        } catch (RuntimeException e) {
            log.error("Controller grant error during token login for subscription {}", subscription.getId(), e);
            throw ApiProblem.unprocessable("Controller unavailable",
                    "Could not establish a session. Please try again shortly.");
        }
        if (!result.ok()) {
            throw ApiProblem.unprocessable("Controller unavailable",
                    "Could not establish a session: " + result.error());
        }

        // controllerSessionId is unique: reuse the row if a previous grant was revoked.
        ActiveSession row = sessions.findByControllerSessionId(result.grantRef()).orElseGet(ActiveSession::new);
        if (row.getId() == null) {
            row.setSubscription(subscription);
            row.setControllerSessionId(result.grantRef());
            // IP stays NULL until the controller reports it (D-027, FR-D06).
            row.setIpAddress(null);
        }
        row.setStartedAt(now);
        row.setEndedAt(null);
        row.setEndReason(null);
        return sessions.save(row).getStartedAt();
    }

    /** Active token row for resend/inspection (never exposes the raw value). */
    public java.util.Optional<AccessToken> activeToken(Long subscriptionId) {
        return tokens.findBySubscriptionIdAndStatus(subscriptionId, TokenStatus.ACTIVE).stream().findFirst();
    }

    /** Token rotation used by purchase flow — delegated to keep D-012 in one place. */
    @Transactional
    public String rotateToken(Subscription subscription) {
        return tokenService.rotate(subscription, subscription.getEndsAt());
    }
}
