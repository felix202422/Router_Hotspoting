package com.hotspot.service.admin;

import com.hotspot.common.ApiProblem;
import com.hotspot.common.AuditService;
import com.hotspot.domain.DeviceStatus;
import com.hotspot.domain.RegisteredDevice;
import com.hotspot.domain.Subscription;
import com.hotspot.domain.SubscriptionStatus;
import com.hotspot.repository.ActiveSessionRepository;
import com.hotspot.repository.AccessTokenRepository;
import com.hotspot.repository.PaymentRepository;
import com.hotspot.repository.RegisteredDeviceRepository;
import com.hotspot.repository.SubscriptionRepository;
import com.hotspot.service.SubscriptionService;
import com.hotspot.web.dto.admin.PagedDto;
import com.hotspot.web.dto.admin.PaymentDto;
import com.hotspot.web.dto.admin.SubscriptionAdminDto;
import com.hotspot.web.dto.admin.SubscriptionDetailDto;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A17–A20: subscription views and reversible/terminal actions. */
@Service
public class AdminSubscriptionService {

    private final SubscriptionRepository subscriptions;
    private final AccessTokenRepository tokens;
    private final RegisteredDeviceRepository devices;
    private final ActiveSessionRepository sessions;
    private final PaymentRepository payments;
    private final SubscriptionService lifecycle;
    private final AuditService audit;

    public AdminSubscriptionService(SubscriptionRepository subscriptions, AccessTokenRepository tokens,
                                    RegisteredDeviceRepository devices, ActiveSessionRepository sessions,
                                    PaymentRepository payments, SubscriptionService lifecycle, AuditService audit) {
        this.subscriptions = subscriptions;
        this.tokens = tokens;
        this.devices = devices;
        this.sessions = sessions;
        this.payments = payments;
        this.lifecycle = lifecycle;
        this.audit = audit;
    }

    /** A17 — filters + upcoming expirations, 1-based paging. */
    @Transactional(readOnly = true)
    public PagedDto<SubscriptionAdminDto> list(SubscriptionStatus status, String search,
                                               Integer expiringWithinHours, int page, int size) {
        Instant now = Instant.now();
        Specification<Subscription> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (search != null && !search.isBlank()) {
                String term = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("customer").get("phoneE164")), term),
                        cb.like(cb.lower(root.get("pkg").get("name")), term)));
            }
            if (expiringWithinHours != null && expiringWithinHours > 0) {
                predicates.add(cb.equal(root.get("status"), SubscriptionStatus.ACTIVE));
                predicates.add(cb.between(root.get("endsAt"), now, now.plus(Duration.ofHours(expiringWithinHours))));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Page<SubscriptionAdminDto> result = subscriptions.findAll(spec,
                        PageRequest.of(page - 1, size, Sort.by(Sort.Order.desc("startsAt"), Sort.Order.desc("id"))))
                .map(this::toDto);
        return PagedDto.of(result);
    }

    /** A18 — detail + payment/session history. */
    @Transactional(readOnly = true)
    public SubscriptionDetailDto detail(Long id) {
        Subscription sub = find(id);
        var paymentRows = payments.findByActivatedSubscriptionIdOrderByPaidAtDesc(id).stream()
                .map(PaymentDto::from).toList();
        var sessionHistory = sessions.findBySubscriptionIdOrderByStartedAtDesc(id).stream()
                .map(s -> s.getStartedAt()).toList();
        return new SubscriptionDetailDto(toDto(sub), paymentRows, sessionHistory);
    }

    /** A19 — suspend/resume (reversible) and A20 — permanent revoke. */
    @Transactional
    public void action(Long id, String action, String ip) {
        Subscription sub = find(id);
        String before = sub.getStatus().name();
        String auditAction;
        String after;
        switch (action) {
            case "suspend" -> {
                lifecycle.suspend(sub, "Suspended by administrator");
                auditAction = "SUBSCRIPTION_SUSPEND";
                after = SubscriptionStatus.SUSPENDED.name();
            }
            case "resume" -> {
                lifecycle.resume(sub);
                auditAction = "SUBSCRIPTION_RESUME";
                after = SubscriptionStatus.ACTIVE.name();
            }
            case "revoke" -> {
                lifecycle.revoke(sub);
                auditAction = "SUBSCRIPTION_REVOKE";
                after = SubscriptionStatus.SUSPENDED.name() + " (token revoked)";
            }
            default -> throw ApiProblem.badRequest("Validation failed",
                    "action must be suspend, resume or revoke.");
        }
        audit.recordAdmin(auditAction, "subscription", id, before, after, ip);
    }

    private Subscription find(Long id) {
        return subscriptions.findById(id)
                .orElseThrow(() -> ApiProblem.notFound("Subscription not found."));
    }

    private SubscriptionAdminDto toDto(Subscription sub) {
        String label = devices.findBySubscriptionIdAndStatus(sub.getId(), DeviceStatus.ACTIVE).stream()
                .findFirst().map(RegisteredDevice::getDeviceLabel).orElse(null);
        String hint = tokens.findBySubscriptionIdAndStatus(sub.getId(),
                        com.hotspot.domain.TokenStatus.ACTIVE).stream()
                .findFirst().map(t -> "…" + t.getTokenHint()).orElse(null);
        return SubscriptionAdminDto.of(sub, label, hint);
    }
}
