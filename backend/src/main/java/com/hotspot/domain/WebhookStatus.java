package com.hotspot.domain;

/** Payment webhook ingestion state (FR-M03 idempotency). */
public enum WebhookStatus {
    RECEIVED,
    PROCESSED,
    IGNORED,
    ERROR
}
