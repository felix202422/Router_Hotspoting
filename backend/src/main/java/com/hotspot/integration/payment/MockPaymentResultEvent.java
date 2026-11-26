package com.hotspot.integration.payment;

/**
 * Internal event published by the MOCK payment provider only (dev/test).
 * The service layer listens and runs the exact same activation core that the
 * real Daraja webhook will drive in Phase 5 — no separate "fake success" path.
 */
public record MockPaymentResultEvent(
        String purchaseId,
        String providerReference,
        boolean success,
        String failureReason) {
}
