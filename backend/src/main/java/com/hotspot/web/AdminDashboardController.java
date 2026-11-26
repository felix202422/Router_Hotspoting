package com.hotspot.web;

import com.hotspot.common.Paging;
import com.hotspot.domain.PaymentStatus;
import com.hotspot.service.admin.AdminAnalyticsService;
import com.hotspot.web.dto.admin.CustomerAnalyticsDto;
import com.hotspot.web.dto.admin.PackageAnalyticsDto;
import com.hotspot.web.dto.admin.RevenueAnalyticsDto;
import com.hotspot.web.dto.admin.StatsOverviewDto;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** A5 + A23–A26: dashboard KPIs, analytics and CSV export (JWT-admin only). */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminDashboardController {

    private final AdminAnalyticsService analytics;

    public AdminDashboardController(AdminAnalyticsService analytics) {
        this.analytics = analytics;
    }

    /** A5 — `range` is accepted for contract compatibility; all KPIs are returned. */
    @GetMapping("/stats/overview")
    public StatsOverviewDto overview(@RequestParam(required = false) String range) {
        return analytics.overview();
    }

    @GetMapping("/analytics/revenue")
    public RevenueAnalyticsDto revenue(@RequestParam String from, @RequestParam String to,
                                       @RequestParam(required = false) Long packageId,
                                       @RequestParam(required = false) PaymentStatus status) {
        return analytics.revenue(from, to, packageId, status);
    }

    @GetMapping("/analytics/packages")
    public List<PackageAnalyticsDto> packageAnalytics(@RequestParam String from, @RequestParam String to) {
        return analytics.packages(from, to);
    }

    @GetMapping("/analytics/customers")
    public CustomerAnalyticsDto customerAnalytics(@RequestParam String from, @RequestParam String to) {
        return analytics.customers(from, to);
    }

    @GetMapping(value = "/analytics/export.csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<String> exportCsv(@RequestParam String from, @RequestParam String to,
                                            @RequestParam(required = false) Long packageId,
                                            @RequestParam(required = false) PaymentStatus status) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=payments.csv")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(analytics.exportCsv(from, to, packageId, status));
    }
}
