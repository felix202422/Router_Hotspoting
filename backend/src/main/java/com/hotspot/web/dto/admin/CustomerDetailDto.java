package com.hotspot.web.dto.admin;

import com.hotspot.domain.Customer;
import com.hotspot.web.dto.SubscriptionSummaryDto;
import java.time.Instant;
import java.util.List;

/** Frontend `CustomerDetail` = Customer + payments/subscriptions/device/replacements. */
public record CustomerDetailDto(Long id, String phoneE164, String displayName, String status,
                                Instant firstSeenAt, Instant lastSeenAt,
                                SubscriptionSummaryDto activeSubscription,
                                long totalPurchases, long totalSpentTzs, String deviceLabel,
                                List<PaymentDto> payments, List<SubscriptionAdminDto> subscriptions,
                                RegisteredDeviceDto device, List<ReplacementDto> replacements) {

    public static CustomerDetailDto of(CustomerDto base, List<PaymentDto> payments,
                                       List<SubscriptionAdminDto> subscriptions,
                                       RegisteredDeviceDto device, List<ReplacementDto> replacements) {
        return new CustomerDetailDto(base.id(), base.phoneE164(), base.displayName(), base.status(),
                base.firstSeenAt(), base.lastSeenAt(), base.activeSubscription(),
                base.totalPurchases(), base.totalSpentTzs(), base.deviceLabel(),
                payments, subscriptions, device, replacements);
    }
}
