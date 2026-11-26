package com.hotspot.service;

import com.hotspot.common.AuditService;
import com.hotspot.domain.Subscription;
import com.hotspot.domain.SubscriptionStatus;
import com.hotspot.repository.SubscriptionRepository;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Expiry sweep (system-architecture §4.2): every minute, ACTIVE subscriptions
 * past endsAt are marked EXPIRED and their access (token/session/device/grant)
 * is revoked. Pessimistic row lock makes concurrent sweeps safe; financial
 * history (payments) is never touched (NFR-06).
 */
@Service
@ConditionalOnProperty(name = "app.scheduler.expiry-sweep-enabled", havingValue = "true", matchIfMissing = true)
public class ExpiryService {

    private static final Logger log = LoggerFactory.getLogger(ExpiryService.class);

    private final SubscriptionRepository subscriptions;
    private final SubscriptionService subscriptionService;
    private final AuditService audit;

    public ExpiryService(SubscriptionRepository subscriptions,
                         SubscriptionService subscriptionService,
                         AuditService audit) {
        this.subscriptions = subscriptions;
        this.subscriptionService = subscriptionService;
        this.audit = audit;
    }

    /** One sweep pass — public for tests and manual triggering. */
    @Transactional
    public int sweepOnce() {
        Instant now = Instant.now();
        List<Subscription> expired =
                subscriptions.findExpiredActiveForSweep(SubscriptionStatus.ACTIVE, now);
        for (Subscription subscription : expired) {
            subscriptionService.markExpired(subscription, now);
        }
        if (!expired.isEmpty()) {
            log.info("Expiry sweep: revoked {} subscription(s)", expired.size());
        }
        return expired.size();
    }

    @Scheduled(fixedDelayString = "${app.scheduler.expiry-sweep-ms:60000}")
    public void scheduledSweep() {
        try {
            sweepOnce();
        } catch (RuntimeException e) {
            log.error("Expiry sweep failed", e);
        }
    }
}
