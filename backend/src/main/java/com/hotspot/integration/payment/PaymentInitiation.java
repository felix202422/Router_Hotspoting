package com.hotspot.integration.payment;

/** Provider-neutral payment initiation input (api-contract P2). */
public record PaymentInitiation(
        String purchaseId,
        String phoneE164,
        long amountTzs,
        String packageDescription) {
}
