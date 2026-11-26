package com.hotspot.web;

import com.hotspot.common.ClientIp;
import com.hotspot.domain.ReplacementStatus;
import com.hotspot.service.admin.AdminCustomerService;
import com.hotspot.web.dto.admin.ReplacementDto;
import com.hotspot.web.dto.admin.ReviewRequestDto;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** A10/A11 — replacement queue and admin review (no OTP, D-006). */
@RestController
@RequestMapping("/api/v1/admin/device-replacements")
public class AdminReplacementController {

    private final AdminCustomerService customers;

    public AdminReplacementController(AdminCustomerService customers) {
        this.customers = customers;
    }

    @GetMapping
    public List<ReplacementDto> list(@RequestParam(required = false) ReplacementStatus status) {
        return customers.replacements(status);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Void> approve(@PathVariable Long id, HttpServletRequest request) {
        customers.reviewReplacement(id, ReplacementStatus.APPROVED, null, ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<Void> reject(@PathVariable Long id,
                                       @RequestBody(required = false) ReviewRequestDto body,
                                       HttpServletRequest request) {
        customers.reviewReplacement(id, ReplacementStatus.REJECTED,
                body == null ? null : body.reason(), ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }
}
