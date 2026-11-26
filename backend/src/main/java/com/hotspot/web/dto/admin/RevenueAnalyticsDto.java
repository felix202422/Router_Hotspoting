package com.hotspot.web.dto.admin;

import java.util.List;

/** A23 — TZ-day/week/month buckets. Profit stays null until expenses are tracked (FR-R05). */
public record RevenueAnalyticsDto(String currency, List<Bucket> buckets, Totals totals) {

    public record Bucket(String period, long revenueTzs, long payments) {
    }

    public record Totals(long revenueTzs, long payments, long grossTzs,
                         long refundedTzs, Long profitTzs) {
    }
}
