package com.hotspot.web.dto;

import com.hotspot.domain.Subscription;
import java.time.Duration;
import java.time.Instant;

/** Shared `SubscriptionSummary` shape (P3/P5/P6) from the frontend contract. */
public record SubscriptionSummaryDto(
        Long id,
        Long packageId,
        String packageName,
        String status,
        Instant startsAt,
        Instant endsAt,
        long remainingSeconds) {

    public static SubscriptionSummaryDto from(Subscription subscription) {
        long remaining = Math.max(0L, Duration.between(Instant.now(), subscription.getEndsAt()).getSeconds());
        return new SubscriptionSummaryDto(subscription.getId(), subscription.getPkg().getId(),
                subscription.getPkg().getName(), subscription.getStatus().name(),
                subscription.getStartsAt(), subscription.getEndsAt(), remaining);
    }
}
