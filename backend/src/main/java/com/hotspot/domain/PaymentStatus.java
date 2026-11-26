package com.hotspot.domain;

/** Payment lifecycle. Financial rows are never hard-deleted (NFR-06). */
public enum PaymentStatus {
    PENDING,
    SUCCESS,
    FAILED,
    REFUNDED
}
