package com.hotspot.web;

import com.hotspot.common.ClientIp;
import com.hotspot.common.Paging;
import com.hotspot.domain.SubscriptionStatus;
import com.hotspot.service.admin.AdminSubscriptionService;
import com.hotspot.web.dto.admin.PagedDto;
import com.hotspot.web.dto.admin.SubscriptionAdminDto;
import com.hotspot.web.dto.admin.SubscriptionDetailDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** A17–A20 — subscription views and lifecycle actions. */
@RestController
@RequestMapping("/api/v1/admin/subscriptions")
public class AdminSubscriptionController {

    private final AdminSubscriptionService subscriptions;

    public AdminSubscriptionController(AdminSubscriptionService subscriptions) {
        this.subscriptions = subscriptions;
    }

    @GetMapping
    public PagedDto<SubscriptionAdminDto> list(
            @RequestParam(required = false) SubscriptionStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(name = "expiringWithinHours", required = false) Integer expiringWithinHours,
            @RequestParam(name = "expiringWithin", required = false) Integer expiringWithin,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "25") int size) {
        Integer hours = expiringWithinHours != null ? expiringWithinHours : expiringWithin;
        return subscriptions.list(status, search, hours, Paging.page(page), Paging.size(size));
    }

    @GetMapping("/{id}")
    public SubscriptionDetailDto detail(@PathVariable Long id) {
        return subscriptions.detail(id);
    }

    @PostMapping("/{id}/suspend")
    public ResponseEntity<Void> suspend(@PathVariable Long id, HttpServletRequest request) {
        subscriptions.action(id, "suspend", ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<Void> resume(@PathVariable Long id, HttpServletRequest request) {
        subscriptions.action(id, "resume", ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/revoke")
    public ResponseEntity<Void> revoke(@PathVariable Long id, HttpServletRequest request) {
        subscriptions.action(id, "revoke", ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }
}
