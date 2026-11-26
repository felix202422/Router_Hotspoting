package com.hotspot.service.admin;

import com.hotspot.common.ApiProblem;
import com.hotspot.common.AuditService;
import com.hotspot.common.TzDates;
import com.hotspot.domain.Payment;
import com.hotspot.domain.PaymentStatus;
import com.hotspot.domain.Subscription;
import com.hotspot.repository.PaymentRepository;
import com.hotspot.service.SmsService;
import com.hotspot.service.TokenService;
import com.hotspot.web.dto.admin.PagedDto;
import com.hotspot.web.dto.admin.PaymentDto;
import java.time.Instant;
import java.util.ArrayList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A21 payment table and A22 "resend the SAME token" (D-028). */
@Service
public class AdminPaymentService {

    private final PaymentRepository payments;
    private final TokenService tokens;
    private final SmsService sms;
    private final AuditService audit;

    public AdminPaymentService(PaymentRepository payments, TokenService tokens,
                               SmsService sms, AuditService audit) {
        this.payments = payments;
        this.tokens = tokens;
        this.sms = sms;
        this.audit = audit;
    }

    /** A21 — filters from/to are TZ dates (Africa/Dar_es_Salaam), page is 1-based. */
    @Transactional(readOnly = true)
    public PagedDto<PaymentDto> list(String from, String to, PaymentStatus status,
                                     Long packageId, String phone, int page, int size) {
        Instant[] range = (from == null && to == null) ? null : TzDates.range(
                from == null ? "2000-01-01" : from,
                to == null ? "2100-12-31" : to);
        Specification<Payment> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (range != null) {
                predicates.add(cb.between(root.get("paidAt"), range[0], range[1]));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (packageId != null) {
                predicates.add(cb.equal(root.get("pkg").get("id"), packageId));
            }
            if (phone != null && !phone.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("phoneE164")),
                        "%" + phone.trim().replace(" ", "").toLowerCase() + "%"));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Page<PaymentDto> result = payments.findAll(spec,
                        PageRequest.of(page - 1, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))))
                .map(PaymentDto::from);
        return PagedDto.of(result);
    }

    /** A22 — re-deliver the escrowed raw token by SMS; never return it in HTTP. */
    @Transactional
    public void resendToken(Long paymentId, String ip) {
        Payment payment = payments.findById(paymentId)
                .orElseThrow(() -> ApiProblem.notFound("Payment not found."));
        Subscription sub = payment.getActivatedSubscription();
        if (sub == null) {
            throw ApiProblem.conflict("Token unavailable",
                    "This payment did not activate a subscription — no token can be re-sent.");
        }
        String raw = tokens.revealForResend(sub.getId()); // 409 when revoked/expired/no escrow
        sms.sendToken(payment.getCustomer(), sub, raw, sub.getPkg().getName());
        audit.recordAdmin("PAYMENT_RESEND_TOKEN", "payment", paymentId, null,
                "Re-sent access token to " + payment.getPhoneE164(), ip);
    }
}
