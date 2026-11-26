package com.hotspot.web.dto.admin;

/** A5: dashboard KPIs. `enforcementActive` is additive (frontend StatsOverview). */
public record StatsOverviewDto(long revenueToday, long revenueWeek, long revenueMonth,
                               long revenueYear, long revenueTotal, long activeSubscriptions,
                               long connectedCustomers, long totalPurchases,
                               long expiredSubscriptions, long failedPayments,
                               long pendingPayments, boolean enforcementActive) {
}
