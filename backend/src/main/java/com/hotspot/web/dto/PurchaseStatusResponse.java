package com.hotspot.web.dto;

/** P3 response — mirrors frontend `PurchaseStatusResponse` exactly (no PII/token). */
public record PurchaseStatusResponse(
        String purchaseId,
        String status,
        String failureReason,
        SubscriptionSummaryDto subscription) {
}
