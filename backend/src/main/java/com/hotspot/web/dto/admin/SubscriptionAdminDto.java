package com.hotspot.web.dto.admin;

import com.hotspot.domain.Subscription;
import java.time.Instant;

/** Frontend `SubscriptionAdmin` (A17/A18 and CustomerDetail.subscriptions). */
public record SubscriptionAdminDto(Long id, Long customerId, String phoneE164, Long packageId,
                                   String packageName, Long paymentId, String status,
                                   Instant startsAt, Instant endsAt, Instant activatedAt,
                                   int extensionCount, String deviceLabel, String tokenHint) {

    public static SubscriptionAdminDto of(Subscription sub, String deviceLabel, String tokenHint) {
        return new SubscriptionAdminDto(sub.getId(), sub.getCustomer().getId(),
                sub.getCustomer().getPhoneE164(), sub.getPkg().getId(), sub.getPkg().getName(),
                sub.getPayment().getId(), sub.getStatus().name(), sub.getStartsAt(), sub.getEndsAt(),
                sub.getActivatedAt(), sub.getExtensionCount() == null ? 0 : sub.getExtensionCount(),
                deviceLabel, tokenHint);
    }
}
