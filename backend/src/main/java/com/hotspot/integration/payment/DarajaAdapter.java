package com.hotspot.integration.payment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * M-Pesa Daraja adapter placeholder (decision D-003: sandbox-first, credentials
 * pending from the owner). Wired only when payment.provider=daraja; every call
 * fails honestly until Phase 5 — it never simulates a successful payment.
 */
@Component
@ConditionalOnProperty(name = "app.payment.provider", havingValue = "daraja")
public class DarajaAdapter implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(DarajaAdapter.class);

    @Override
    public String name() {
        return "MPESA_DARAJA";
    }

    @Override
    public InitiationResult initiate(PaymentInitiation request) {
        log.error("Daraja initiate called but the adapter is not implemented yet (Phase 5). purchase={}",
                request.purchaseId());
        throw new IllegalStateException(
                "M-Pesa Daraja integration arrives in Phase 5 — payment temporarily unavailable (NFR-04 degraded mode).");
    }

    @Override
    public boolean verifySignature(String rawBody, String signatureHeader) {
        // Phase 5: HMAC-SHA256 over the raw body with DARAJA_WEBHOOK_SECRET.
        // Until then NO callback can be trusted — reject everything (FR-M02).
        log.warn("Daraja webhook received before Phase 5 integration — rejecting (signature verification not configured).");
        return false;
    }
}
