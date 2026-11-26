package com.hotspot.service.admin;

import com.hotspot.common.TzDates;
import com.hotspot.domain.Package;
import com.hotspot.domain.Payment;
import com.hotspot.domain.PaymentStatus;
import com.hotspot.integration.hotspot.HotspotController;
import com.hotspot.repository.ActiveSessionRepository;
import com.hotspot.repository.PaymentRepository;
import com.hotspot.repository.SubscriptionRepository;
import com.hotspot.web.dto.admin.CustomerAnalyticsDto;
import com.hotspot.web.dto.admin.PackageAnalyticsDto;
import com.hotspot.web.dto.admin.RevenueAnalyticsDto;
import com.hotspot.web.dto.admin.StatsOverviewDto;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A5/A23–A26. Revenue is verified SUCCESS payments only, refunds are tracked
 * separately, profit stays null until expenses are tracked (FR-R01–R05).
 * All bucketing uses Africa/Dar_es_Salaam calendar days.
 */
@Service
public class AdminAnalyticsService {

    private final PaymentRepository payments;
    private final SubscriptionRepository subscriptions;
    private final ActiveSessionRepository sessions;
    private final HotspotController controller;

    public AdminAnalyticsService(PaymentRepository payments, SubscriptionRepository subscriptions,
                                 ActiveSessionRepository sessions, HotspotController controller) {
        this.payments = payments;
        this.subscriptions = subscriptions;
        this.sessions = sessions;
        this.controller = controller;
    }

    /** A5 — dashboard KPI cards. The optional `range` is additive; all KPIs are returned. */
    @Transactional(readOnly = true)
    public StatsOverviewDto overview() {
        Instant now = Instant.now();
        return new StatsOverviewDto(
                sumOrZero(payments.sumSuccessfulSince(TzDates.startOfToday())),
                sumOrZero(payments.sumSuccessfulSince(TzDates.startOfWeek())),
                sumOrZero(payments.sumSuccessfulSince(TzDates.startOfMonth())),
                sumOrZero(payments.sumSuccessfulSince(TzDates.startOfYear())),
                sumOrZero(payments.sumSuccessfulSince(Instant.EPOCH)),
                subscriptions.countByStatusAndEndsAtAfter(com.hotspot.domain.SubscriptionStatus.ACTIVE, now),
                sessions.countByEndedAtIsNull(),
                payments.countByStatus(PaymentStatus.SUCCESS),
                subscriptions.countByStatus(com.hotspot.domain.SubscriptionStatus.EXPIRED),
                payments.countByStatus(PaymentStatus.FAILED),
                payments.countByStatus(PaymentStatus.PENDING),
                controller.enforcementActive());
    }

    /** A23 — day/week/month buckets with zero-filled gaps. */
    @Transactional(readOnly = true)
    public RevenueAnalyticsDto revenue(String from, String to, Long packageId, PaymentStatus status) {
        Instant[] range = TzDates.range(from, to);
        List<Payment> inRange = filtered(range, packageId, status);
        List<Payment> verified = inRange.stream().filter(p -> p.getStatus() == PaymentStatus.SUCCESS).toList();
        long revenue = verified.stream().mapToLong(Payment::getAmountTzs).sum();

        TzDates.BucketSize size = TzDates.bucketSize(range[0], range[1]);
        LinkedHashMap<String, long[]> buckets = TzDates.emptyBuckets(range[0], range[1], size);
        for (Payment payment : verified) {
            if (payment.getPaidAt() == null) {
                continue;
            }
            long[] bucket = buckets.get(TzDates.bucketKey(payment.getPaidAt(), size));
            if (bucket != null) {
                bucket[0] += payment.getAmountTzs();
                bucket[1] += 1;
            }
        }
        long refunded = inRange.stream()
                .filter(p -> p.getStatus() == PaymentStatus.REFUNDED)
                .mapToLong(Payment::getAmountTzs).sum();
        List<RevenueAnalyticsDto.Bucket> rows = buckets.entrySet().stream()
                .map(e -> new RevenueAnalyticsDto.Bucket(e.getKey(), e.getValue()[0], e.getValue()[1])).toList();
        return new RevenueAnalyticsDto("TZS", rows,
                new RevenueAnalyticsDto.Totals(revenue, verified.size(), revenue + refunded, refunded, null));
    }

    /** A24 — revenue/share per package, most-purchased first. */
    @Transactional(readOnly = true)
    public List<PackageAnalyticsDto> packages(String from, String to) {
        Instant[] range = TzDates.range(from, to);
        List<Payment> verified = filtered(range, null, null).stream()
                .filter(p -> p.getStatus() == PaymentStatus.SUCCESS).toList();
        Map<Long, long[]> byPackage = new LinkedHashMap<>();
        for (Payment payment : verified) {
            long[] row = byPackage.computeIfAbsent(payment.getPkg().getId(), k -> new long[2]);
            row[0] += 1;
            row[1] += payment.getAmountTzs();
        }
        long total = byPackage.values().stream().mapToLong(row -> row[1]).sum();
        return byPackage.entrySet().stream().map(e -> {
            Package pkg = verified.stream().map(Payment::getPkg)
                    .filter(p -> p.getId().equals(e.getKey())).findFirst().orElse(null);
            double share = total == 0 ? 0 : Math.round(e.getValue()[1] * 1000.0 / total) / 10.0;
            return new PackageAnalyticsDto(e.getKey(), pkg == null ? "Package #" + e.getKey() : pkg.getName(),
                    e.getValue()[0], e.getValue()[1], share);
        }).sorted((a, b) -> Long.compare(b.revenueTzs(), a.revenueTzs())).toList();
    }

    /** A25 — buyers with a verified purchase before the range are "returning". */
    @Transactional(readOnly = true)
    public CustomerAnalyticsDto customers(String from, String to) {
        Instant[] range = TzDates.range(from, to);
        List<Payment> verified = filtered(range, null, null).stream()
                .filter(p -> p.getStatus() == PaymentStatus.SUCCESS).toList();
        Set<Long> buyers = verified.stream().map(p -> p.getCustomer().getId()).collect(Collectors.toSet());
        Set<Long> earlier = payments.findByStatusAndPaidAtBefore(PaymentStatus.SUCCESS, range[0]).stream()
                .map(p -> p.getCustomer().getId()).collect(Collectors.toSet());
        long returning = buyers.stream().filter(earlier::contains).count();
        long expired = subscriptions.findByStatusAndEndsAtBetween(
                com.hotspot.domain.SubscriptionStatus.EXPIRED, range[0], range[1]).size();
        int percent = buyers.isEmpty() ? 0 : (int) Math.round(returning * 100.0 / buyers.size());
        return new CustomerAnalyticsDto(buyers.size() - returning, returning, percent, expired);
    }

    /** A26 — CSV with the same filters as A21/A23; EAT timestamps (UTC+3). */
    @Transactional(readOnly = true)
    public String exportCsv(String from, String to, Long packageId, PaymentStatus status) {
        Instant[] range = TzDates.range(from, to);
        List<Payment> rows = filtered(range, packageId, status).stream()
                .sorted(java.util.Comparator.comparing(Payment::getCreatedAt).reversed()).toList();
        StringBuilder csv = new StringBuilder("Reference,Phone,Package,Amount (TZS),Provider,Provider Ref,"
                + "Status,Paid At (EAT),Created At (EAT)\r\n");
        for (Payment payment : rows) {
            csv.append(cell(payment.getIdempotencyKey())).append(',')
                    .append(cell(payment.getPhoneE164())).append(',')
                    .append(cell(payment.getPkg().getName())).append(',')
                    .append(payment.getAmountTzs()).append(',')
                    .append(cell(payment.getProvider())).append(',')
                    .append(cell(payment.getProviderReference())).append(',')
                    .append(payment.getStatus().name()).append(',')
                    .append(cell(payment.getPaidAt() == null ? "" : TzDates.EAT_LABEL.format(payment.getPaidAt())))
                    .append(',').append(cell(TzDates.EAT_LABEL.format(payment.getCreatedAt()))).append("\r\n");
        }
        return csv.toString();
    }

    private List<Payment> filtered(Instant[] range, Long packageId, PaymentStatus status) {
        return payments.findByPaidAtBetween(range[0], range[1]).stream()
                .filter(p -> packageId == null || p.getPkg().getId().equals(packageId))
                .filter(p -> status == null || p.getStatus() == status)
                .toList();
    }

    private static long sumOrZero(Long value) {
        return value == null ? 0L : value;
    }

    private static String cell(Object value) {
        String text = value == null ? "" : String.valueOf(value);
        if (text.contains(",") || text.contains("\"") || text.contains("\n")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }
}
