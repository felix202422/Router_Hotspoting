package com.hotspot.web;

import com.hotspot.common.ClientIp;
import com.hotspot.common.Paging;
import com.hotspot.domain.PaymentStatus;
import com.hotspot.service.admin.AdminPaymentService;
import com.hotspot.web.dto.admin.PagedDto;
import com.hotspot.web.dto.admin.PaymentDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** A21/A22 — payment table and SAME-token resend (409 unless escrow is active). */
@RestController
@RequestMapping("/api/v1/admin/payments")
public class AdminPaymentController {

    private final AdminPaymentService payments;

    public AdminPaymentController(AdminPaymentService payments) {
        this.payments = payments;
    }

    @GetMapping
    public PagedDto<PaymentDto> list(@RequestParam(required = false) String from,
                                     @RequestParam(required = false) String to,
                                     @RequestParam(required = false) PaymentStatus status,
                                     @RequestParam(required = false) Long packageId,
                                     @RequestParam(required = false) String phone,
                                     @RequestParam(defaultValue = "1") int page,
                                     @RequestParam(defaultValue = "25") int size) {
        return payments.list(from, to, status, packageId, phone, Paging.page(page), Paging.size(size));
    }

    @PostMapping("/{id}/resend-token")
    public ResponseEntity<Void> resendToken(@PathVariable Long id, HttpServletRequest request) {
        payments.resendToken(id, ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }
}
