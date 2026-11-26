package com.hotspot.web.dto.admin;

import com.hotspot.domain.Customer;
import com.hotspot.web.dto.SubscriptionSummaryDto;
import java.time.Instant;

/** Frontend `Customer` (A6 list row). */
public record CustomerDto(Long id, String phoneE164, String displayName, String status,
                          Instant firstSeenAt, Instant lastSeenAt,
                          SubscriptionSummaryDto activeSubscription,
                          long totalPurchases, long totalSpentTzs, String deviceLabel) {

    public static CustomerDto of(Customer customer, SubscriptionSummaryDto active,
                                 long totalPurchases, long totalSpentTzs, String deviceLabel) {
        return new CustomerDto(customer.getId(), customer.getPhoneE164(), customer.getDisplayName(),
                customer.getStatus().name(), customer.getFirstSeenAt(), customer.getLastSeenAt(),
                active, totalPurchases, totalSpentTzs, deviceLabel);
    }
}
