package com.hotspot.service.admin;

import com.hotspot.common.AuditService;
import com.hotspot.common.ApiProblem;
import com.hotspot.domain.ActiveSession;
import com.hotspot.domain.Administrator;
import com.hotspot.domain.Customer;
import com.hotspot.domain.CustomerStatus;
import com.hotspot.domain.DeviceStatus;
import com.hotspot.domain.DeviceReplacement;
import com.hotspot.domain.EndReason;
import com.hotspot.domain.RegisteredDevice;
import com.hotspot.domain.ReplacementStatus;
import com.hotspot.domain.Subscription;
import com.hotspot.domain.SubscriptionStatus;
import com.hotspot.integration.hotspot.HotspotController;
import com.hotspot.repository.ActiveSessionRepository;
import com.hotspot.repository.AdministratorRepository;
import com.hotspot.repository.CustomerRepository;
import com.hotspot.repository.DeviceReplacementRepository;
import com.hotspot.repository.PaymentRepository;
import com.hotspot.repository.RegisteredDeviceRepository;
import com.hotspot.repository.SubscriptionRepository;
import com.hotspot.service.SubscriptionService;
import com.hotspot.web.dto.SubscriptionSummaryDto;
import com.hotspot.web.dto.admin.CustomerDetailDto;
import com.hotspot.web.dto.admin.CustomerDto;
import com.hotspot.web.dto.admin.PagedDto;
import com.hotspot.web.dto.admin.PaymentDto;
import com.hotspot.web.dto.admin.RegisteredDeviceDto;
import com.hotspot.web.dto.admin.ReplacementDto;
import com.hotspot.web.dto.admin.SubscriptionAdminDto;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin customers, devices, replacement queue and force-disconnect (A6–A12).
 * Every mutation is audited as ADMIN; the underlying subscription service also
 * records SYSTEM rows for the access changes it performs.
 */
@Service
public class AdminCustomerService {

    private static final Logger log = LoggerFactory.getLogger(AdminCustomerService.class);

    private final CustomerRepository customers;
    private final SubscriptionRepository subscriptions;
    private final PaymentRepository payments;
    private final RegisteredDeviceRepository devices;
    private final DeviceReplacementRepository replacements;
    private final ActiveSessionRepository sessions;
    private final AdministratorRepository administrators;
    private final SubscriptionService subscriptionService;
    private final HotspotController controller;
    private final AuditService audit;

    public AdminCustomerService(CustomerRepository customers, SubscriptionRepository subscriptions,
                                PaymentRepository payments, RegisteredDeviceRepository devices,
                                DeviceReplacementRepository replacements, ActiveSessionRepository sessions,
                                AdministratorRepository administrators, SubscriptionService subscriptionService,
                                HotspotController controller, AuditService audit) {
        this.customers = customers;
        this.subscriptions = subscriptions;
        this.payments = payments;
        this.devices = devices;
        this.replacements = replacements;
        this.sessions = sessions;
        this.administrators = administrators;
        this.subscriptionService = subscriptionService;
        this.controller = controller;
        this.audit = audit;
    }

    /** A6 — search by phone (and display name), 1-based paging. */
    @Transactional(readOnly = true)
    public PagedDto<CustomerDto> list(String search, CustomerStatus status, int page, int size) {
        Specification<Customer> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (search != null && !search.isBlank()) {
                String term = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("phoneE164")), term),
                        cb.like(cb.lower(cb.coalesce(root.get("displayName"), "")), term)));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            // Spring Data JPA cannot translate Sort.nullsLast() into Criteria;
            // an explicit CASE keeps never-seen customers at the bottom.
            query.orderBy(cb.desc(cb.selectCase()
                            .when(cb.isNull(root.get("lastSeenAt")), cb.literal(0))
                            .otherwise(cb.literal(1))),
                    cb.desc(root.get("lastSeenAt")), cb.desc(root.get("id")));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        PageRequest pageable = PageRequest.of(page - 1, size);
        Page<CustomerDto> result = customers.findAll(spec, pageable).map(this::toCustomerDto);
        return PagedDto.of(result);
    }

    /** A7 — profile + active subscription + device + full purchase/subscription history. */
    @Transactional(readOnly = true)
    public CustomerDetailDto detail(Long id) {
        Customer customer = findCustomer(id);
        CustomerDto base = toCustomerDto(customer);
        List<PaymentDto> paymentRows = payments.findByCustomerIdOrderByCreatedAtDesc(id).stream()
                .map(PaymentDto::from).toList();
        List<SubscriptionAdminDto> subscriptionRows = subscriptions.findByCustomerId(id).stream()
                .map(sub -> SubscriptionAdminDto.of(sub, deviceLabelOf(sub.getId()), tokenHintOf(sub.getId())))
                .toList();
        RegisteredDeviceDto device = subscriptionRows.isEmpty() ? null : activeDeviceOf(id);
        List<ReplacementDto> replacementRows = replacements.findByCustomerIdOrderByCreatedAtDesc(id).stream()
                .map(row -> ReplacementDto.from(row, reviewerName(row))).toList();
        return CustomerDetailDto.of(base, paymentRows, subscriptionRows, device, replacementRows);
    }

    /** A8 — suspend/reactivate the customer AND its subscriptions (revokes/restores grants). */
    @Transactional
    public void setStatus(Long id, CustomerStatus status, String ip) {
        Customer customer = findCustomer(id);
        String before = customer.getStatus().name();
        customer.setStatus(status);
        customers.save(customer);
        for (Subscription sub : subscriptions.findByCustomerId(id)) {
            if (status == CustomerStatus.SUSPENDED && sub.getStatus() == SubscriptionStatus.ACTIVE) {
                subscriptionService.suspend(sub, "Customer suspended by administrator");
            } else if (status == CustomerStatus.ACTIVE && sub.getStatus() == SubscriptionStatus.SUSPENDED
                    && sub.getEndsAt().isAfter(Instant.now())) {
                subscriptionService.resume(sub);
            }
        }
        audit.recordAdmin(status == CustomerStatus.SUSPENDED
                        ? "CUSTOMER_SUSPEND" : "CUSTOMER_REACTIVATE",
                "customer", id, before, customer.getStatus().name() + " — access "
                        + (status == CustomerStatus.SUSPENDED ? "revoked" : "restored"), ip);
    }

    /** A9 — currently registered device (404 when none). */
    @Transactional(readOnly = true)
    public RegisteredDeviceDto device(Long id) {
        findCustomer(id);
        RegisteredDeviceDto device = activeDeviceOf(id);
        if (device == null) {
            throw ApiProblem.notFound("No registered device for this customer.");
        }
        return device;
    }

    /** A10 — replacement queue, optionally filtered by status. */
    @Transactional(readOnly = true)
    public List<ReplacementDto> replacements(ReplacementStatus status) {
        List<DeviceReplacement> rows = status == null
                ? replacements.findAllByOrderByCreatedAtDesc()
                : replacements.findByStatusOrderByCreatedAtDesc(status);
        return rows.stream().map(row -> ReplacementDto.from(row, reviewerName(row))).toList();
    }

    /**
     * A11 — approve/reject. Approval disconnects the old session and unbinds the
     * old device; the existing token stays ACTIVE so the customer can bind the
     * new device through P5 (no OTP, D-006/FR-S03).
     */
    @Transactional
    public void reviewReplacement(Long id, ReplacementStatus decision, String reason, String ip) {
        DeviceReplacement row = replacements.findById(id)
                .orElseThrow(() -> ApiProblem.notFound("Device replacement request not found."));
        if (row.getStatus() != ReplacementStatus.PENDING) {
            throw ApiProblem.conflict("Already reviewed", "This request was already reviewed.");
        }
        Long subscriptionId = row.getSubscription().getId();
        String phone = row.getCustomer().getPhoneE164();
        String before = row.getStatus().name();

        row.setStatus(decision);
        row.setReviewedAt(Instant.now());
        Administrator admin = audit.currentAdminId() == null ? null
                : administrators.findById(audit.currentAdminId()).orElse(null);
        row.setReviewedBy(admin);
        if (decision == ReplacementStatus.REJECTED) {
            row.setRejectionReason(reason == null || reason.isBlank()
                    ? "Rejected by administrator" : reason.trim());
        }
        replacements.save(row); // save BEFORE the bulk update that clears the context

        if (decision == ReplacementStatus.APPROVED) {
            List<String> grantRefs = liveGrantRefs(subscriptionId);
            grantRefs.forEach(grantRef -> safeDisconnect(grantRef));
            sessions.endLiveSessions(subscriptionId, EndReason.REPLACE, Instant.now());
            devices.unbindDevices(subscriptionId, DeviceStatus.REMOVED, DeviceStatus.ACTIVE, Instant.now());
        }
        audit.recordAdmin(decision == ReplacementStatus.APPROVED
                        ? "DEVICE_REPLACEMENT_APPROVE" : "DEVICE_REPLACEMENT_REJECT",
                "replacement", id, before, decision.name() + " — " + phone, ip);
    }

    /** A12 — force-disconnect only: token stays valid so the customer can reconnect. */
    @Transactional
    public void disconnectCustomer(Long id, String ip) {
        Customer customer = findCustomer(id);
        Instant now = Instant.now();
        for (Subscription sub : subscriptions.findByCustomerId(id)) {
            if (sub.getStatus() != SubscriptionStatus.ACTIVE) {
                continue;
            }
            List<String> grantRefs = liveGrantRefs(sub.getId());
            grantRefs.forEach(grantRef -> safeDisconnect(grantRef));
            sessions.endLiveSessions(sub.getId(), EndReason.DISCONNECT, now);
        }
        audit.recordAdmin("CUSTOMER_DISCONNECT", "customer", id, null,
                "Disconnected session of customer " + customer.getPhoneE164(), ip);
    }

    /* ------------------------------------------------------------------ */

    private Customer findCustomer(Long id) {
        return customers.findById(id)
                .orElseThrow(() -> ApiProblem.notFound("Customer not found."));
    }

    private CustomerDto toCustomerDto(Customer customer) {
        Subscription active = subscriptions
                .findFirstByCustomerIdAndStatusOrderByEndsAtDesc(customer.getId(), SubscriptionStatus.ACTIVE)
                .filter(sub -> sub.getEndsAt().isAfter(Instant.now()))
                .orElse(null);
        return CustomerDto.of(customer, active == null ? null : SubscriptionSummaryDto.from(active),
                payments.countSuccessfulByCustomer(customer.getId()),
                sumOrZero(payments.sumSuccessfulByCustomer(customer.getId())),
                active == null ? null : deviceLabelOf(active.getId()));
    }

    private static long sumOrZero(Long value) {
        return value == null ? 0L : value;
    }

    private String deviceLabelOf(Long subscriptionId) {
        return devices.findBySubscriptionIdAndStatus(subscriptionId, DeviceStatus.ACTIVE).stream()
                .findFirst().map(RegisteredDevice::getDeviceLabel).orElse(null);
    }

    private String tokenHintOf(Long subscriptionId) {
        return subscriptionService.activeToken(subscriptionId).map(token -> "…" + token.getTokenHint()).orElse(null);
    }

    /** Most recently bound active device across all of the customer's subscriptions. */
    private RegisteredDeviceDto activeDeviceOf(Long customerId) {
        return subscriptions.findByCustomerId(customerId).stream()
                .flatMap(sub -> devices.findBySubscriptionIdAndStatus(sub.getId(), DeviceStatus.ACTIVE).stream())
                .max(java.util.Comparator.comparing(RegisteredDevice::getBoundAt,
                        java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())))
                .map(RegisteredDeviceDto::from).orElse(null);
    }

    private String reviewerName(DeviceReplacement row) {
        if (row.getStatus() == ReplacementStatus.PENDING || row.getReviewedBy() == null) {
            return null;
        }
        return row.getReviewedBy().getFullName();
    }

    private List<String> liveGrantRefs(Long subscriptionId) {
        List<ActiveSession> live = sessions.findBySubscriptionIdOrderByStartedAtDesc(subscriptionId).stream()
                .filter(session -> session.getEndedAt() == null).toList();
        return live.stream().map(ActiveSession::getControllerSessionId).toList();
    }

    private void safeDisconnect(String grantRef) {
        try {
            controller.disconnect(grantRef);
        } catch (RuntimeException e) {
            log.error("Controller disconnect failed for grant {}", grantRef, e);
        }
    }
}
