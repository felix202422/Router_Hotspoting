package com.hotspot.service;

import com.hotspot.common.AuditService;
import com.hotspot.domain.Payment;
import com.hotspot.domain.PaymentStatus;
import com.hotspot.integration.payment.MockPaymentResultEvent;
import com.hotspot.repository.PaymentRepository;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Idempotent payment-result core (FR-M02/M03, system-architecture §4.1).
 * Both the MOCK provider event (dev/test) and — in Phase 5 — the
 * signature-verified Daraja webhook drive this same guarded path: the first
 * verified result wins, replays and late duplicates are ignored, and only a
 * verified SUCCESS activates access (FR-C04). Activation delegates to
 * {@link SubscriptionService#activateOrExtend}, so there is exactly one
 * activation path — never a separate "fake success" shortcut (D-003).
 */
@Service
public class PaymentWebhookService {

    private static final Logger log = LoggerFactory.getLogger(PaymentWebhookService.class);

    private final PaymentRepository payments;
    private final SubscriptionService subscriptionService;
    private final AuditService audit;

    public PaymentWebhookService(PaymentRepository payments,
                                 SubscriptionService subscriptionService,
                                 AuditService audit) {
        this.payments = payments;
        this.subscriptionService = subscriptionService;
        this.audit = audit;
    }

    /**
     * MOCK provider callback (published by MockPaymentProvider after the
     * simulated STK round-trip). Delegates to the shared webhook core so the
     * dev flow exercises the identical logic the real callback will use.
     */
    @EventListener
    @Transactional
    public void onMockPaymentResult(MockPaymentResultEvent event) {
        processVerifiedResult(event.purchaseId(), event.providerReference(),
                event.success(), event.failureReason());
    }

    /**
     * The guarded core. {@code purchaseId} is the P2 idempotency key stored in
     * payments.idempotency_key. Idempotent: only a PENDING payment may
     * transition — anything else is a replay/late duplicate and is ignored
     * (FR-M03), so a double callback can never double-activate.
     *
     * @param providerReference provider's transaction ref (may be null on failure)
     * @param failureReason     provider failure detail (null on success)
     */
    @Transactional
    public void processVerifiedResult(String purchaseId, String providerReference,
                                      boolean success, String failureReason) {
        Payment payment = payments.findByIdempotencyKey(purchaseId).orElse(null);
        if (payment == null) {
            log.warn("Payment result for unknown purchase {} — ignored", purchaseId);
            return;
        }
        if (payment.getStatus() != PaymentStatus.PENDING) {
            log.info("Duplicate payment result for {} (status={}) — ignored (idempotent)",
                    purchaseId, payment.getStatus());
            return;
        }

        if (!success) {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason(failureReason);
            payments.save(payment);
            audit.recordSystem("PAYMENT_FAILED", "payment", payment.getId(),
                    "Provider rejected purchase " + purchaseId + ": " + failureReason);
            log.info("Payment {} failed at provider: {}", purchaseId, failureReason);
            return;
        }

        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setProviderReference(providerReference);
        payment.setPaidAt(Instant.now());
        payments.save(payment);

        // ONE transaction from here: extend/create (D-007) + token rotation +
        // controller grant + SMS (redacted bodies only). A controller failure
        // inside is logged as drift and never blocks the commit.
        subscriptionService.activateOrExtend(payment, payment.getCustomer());
        log.info("Payment {} verified — subscription activated/extended", purchaseId);
    }
}
