package com.hotspot.integration.payment;

/**
 * Payment provider SPI (system-architecture §3) — the ONLY place provider SDKs
 * appear. Selected by app.payment.provider: mock (dev) | daraja (Phase 5).
 * Business logic never sees vendor-specific types (D-010).
 */
public interface PaymentProvider {

    /** Stable provider code stored in payments.provider (e.g. MPESA_DARAJA, MOCK). */
    String name();

    /** Starts a payment attempt (Daraja: STK push). Never throws for business states. */
    InitiationResult initiate(PaymentInitiation request);

    /** Provider signature check for webhooks (FR-M02). False = reject, no state change. */
    boolean verifySignature(String rawBody, String signatureHeader);
}
