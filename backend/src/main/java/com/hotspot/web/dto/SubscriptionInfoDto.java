package com.hotspot.web.dto;

import java.time.Instant;

/** P6 response — mirrors frontend `SubscriptionInfo` exactly. */
public record SubscriptionInfoDto(
        CustomerInfo customer,
        SubscriptionSummaryDto subscription,
        DeviceInfo device) {

    public record CustomerInfo(String phoneE164) {
    }

    public record DeviceInfo(boolean registered, String deviceLabel, Instant boundAt) {
    }
}
