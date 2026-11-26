package com.hotspot.integration.payment;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * DEV-ONLY simulated payment provider (profile payment.provider=mock).
 * Simulates the M-Pesa STK round-trip: after app.payment.mock-callback-seconds
 * it publishes MockPaymentResultEvent, which the service layer processes
 * through the same idempotent webhook core as the real Daraja callback.
 *
 * Demo hook (mirrors the frontend mock): phone numbers ending "0000" fail —
 * this is a local simulation, explicitly NOT a production integration (D-003).
 */
@Component
@ConditionalOnProperty(name = "app.payment.provider", havingValue = "mock", matchIfMissing = true)
public class MockPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(MockPaymentProvider.class);

    private final ApplicationEventPublisher events;
    private final long callbackDelaySeconds;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "mock-payment-callback");
        t.setDaemon(true);
        return t;
    });

    public MockPaymentProvider(ApplicationEventPublisher events,
                               @Value("${app.payment.mock-callback-seconds:4}") long callbackDelaySeconds) {
        this.events = events;
        this.callbackDelaySeconds = callbackDelaySeconds;
    }

    @Override
    public String name() {
        return "MOCK";
    }

    @Override
    public InitiationResult initiate(PaymentInitiation request) {
        String providerReference = "MOCK-" + System.currentTimeMillis() + "-"
                + Integer.toHexString(request.phoneE164().hashCode());
        boolean willFail = request.phoneE164().endsWith("0000");

        scheduler.schedule(() -> {
            try {
                events.publishEvent(new MockPaymentResultEvent(
                        request.purchaseId(),
                        providerReference,
                        !willFail,
                        willFail ? "Customer cancelled the M-Pesa prompt (simulated)" : null));
            } catch (RuntimeException e) {
                log.error("Mock payment callback failed for {}", request.purchaseId(), e);
            }
        }, callbackDelaySeconds, TimeUnit.SECONDS);

        log.info("MOCK payment initiated purchase={} providerRef={} failSimulated={}",
                request.purchaseId(), providerReference, willFail);
        return new InitiationResult(providerReference, "Approve the M-Pesa prompt on your phone", true, null);
    }

    @Override
    public boolean verifySignature(String rawBody, String signatureHeader) {
        // No external caller in mock mode; signature checks are exercised against Daraja (Phase 5).
        return true;
    }
}
