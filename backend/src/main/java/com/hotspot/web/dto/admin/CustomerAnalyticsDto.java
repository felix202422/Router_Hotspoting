package com.hotspot.web.dto.admin;

/** A25 — new vs returning buyers and expired subscriptions in the range. */
public record CustomerAnalyticsDto(long newCustomers, long returningCustomers,
                                   int returningPercent, long expiredSubscriptions) {
}
