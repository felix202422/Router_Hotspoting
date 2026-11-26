package com.hotspot.service;

import com.hotspot.common.ApiProblem;
import com.hotspot.common.RateLimitService;
import com.hotspot.domain.Customer;
import com.hotspot.domain.Package;
import com.hotspot.domain.PackageStatus;
import com.hotspot.domain.Payment;
import com.hotspot.domain.PaymentStatus;
import com.hotspot.integration.payment.InitiationResult;
import com.hotspot.integration.payment.PaymentInitiation;
import com.hotspot.integration.payment.PaymentProvider;
import com.hotspot.repository.CustomerRepository;
import com.hotspot.repository.PackageRepository;
import com.hotspot.repository.PaymentRepository;
import com.hotspot.web.dto.PurchaseInitResponse;
import com.hotspot.web.dto.PurchaseRequest;
import com.hotspot.web.dto.PurchaseStatusResponse;
import com.hotspot.web.dto.SubscriptionSummaryDto;
import java.time.Duration;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public purchase core (P2/P3): rate limits, DB-only packages, opaque refs. */
@Service
public class PurchaseService {

    private static final Logger log = LoggerFactory.getLogger(PurchaseService.class);
    /** E.164 Tanzanian mobile (FR-C01). The frontend strips spaces/dashes first. */
    private static final Pattern PHONE_RE = Pattern.compile("^\\+255\\d{9}$");

    private final PackageRepository packages;
    private final CustomerRepository customers;
    private final PaymentRepository payments;
    private final PaymentProvider paymentProvider;
    private final RateLimitService rateLimiter;

    public PurchaseService(PackageRepository packages, CustomerRepository customers,
                           PaymentRepository payments, PaymentProvider paymentProvider,
                           RateLimitService rateLimiter) {
        this.packages = packages;
        this.customers = customers;
        this.payments = payments;
        this.paymentProvider = paymentProvider;
        this.rateLimiter = rateLimiter;
    }

    /**
     * P2 — initiate a purchase. Two sliding windows per phone (1/30 s, 10/hour):
     * both are consumed only after both checks pass, so a rejected request does
     * not burn the other window.
     */
    @Transactional
    public PurchaseInitResponse initiate(PurchaseRequest request) {
        String phone = normalizePhone(request.phone());
        String fastBucket = "purchase-fast:" + phone;
        String hourBucket = "purchase-hour:" + phone;
        RateLimitService.Decision fast = rateLimiter.tryAcquire(fastBucket, 1, Duration.ofSeconds(30));
        if (!fast.allowed()) {
            throw ApiProblem.tooManyRequests("Too many attempts",
                    "Please wait before trying again. Retry in " + fast.retryAfterSeconds() + " seconds.",
                    fast.retryAfterSeconds());
        }
        RateLimitService.Decision hour = rateLimiter.tryAcquire(hourBucket, 10, Duration.ofHours(1));
        if (!hour.allowed()) {
            rateLimiter.reset(fastBucket); // the hourly check rejected — undo the fast hit
            throw ApiProblem.tooManyRequests("Too many attempts",
                    "Hourly purchase limit reached. Retry in " + hour.retryAfterSeconds() + " seconds.",
                    hour.retryAfterSeconds());
        }

        Package pkg = packages.findById(request.packageId())
                .filter(p -> p.getStatus() == PackageStatus.ACTIVE)
                .orElseThrow(() -> ApiProblem.unprocessable("Package unavailable",
                        "This package is not available for purchase."));

        Customer customer = customers.findByPhoneE164(phone).orElseGet(() -> {
            Customer created = new Customer();
            created.setPhoneE164(phone);
            return customers.save(created);
        });

        String purchaseId = "pur_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        Payment payment = new Payment();
        payment.setIdempotencyKey(purchaseId);
        payment.setCustomer(customer);
        payment.setPkg(pkg);
        payment.setAmountTzs(pkg.getPriceTzs());
        payment.setPhoneE164(phone);
        payment.setProvider(paymentProvider.name());
        payment.setStatus(PaymentStatus.PENDING);
        payments.save(payment);

        InitiationResult result = paymentProvider.initiate(new PaymentInitiation(
                purchaseId, phone, pkg.getPriceTzs(), pkg.getName()));
        if (!result.accepted()) {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason(result.declineReason());
            payments.save(payment);
            throw ApiProblem.unprocessable("Payment initiation declined",
                    result.declineReason() == null ? "The payment provider declined this attempt."
                            : result.declineReason());
        }
        if (result.providerReference() != null) {
            payment.setProviderReference(result.providerReference());
        }
        log.info("Purchase initiated ref={} phone={} package={} provider={}",
                purchaseId, phone, pkg.getName(), paymentProvider.name());

        return new PurchaseInitResponse(purchaseId, PaymentStatus.PENDING.name(),
                new PurchaseInitResponse.PackageBrief(pkg.getName(), pkg.getPriceTzs(), pkg.getDurationSeconds()),
                phone, result.instructions());
    }

    /** P3 — poll by opaque reference; no phone, token or PII leaves this endpoint. */
    @Transactional(readOnly = true)
    public PurchaseStatusResponse status(String purchaseId) {
        Payment payment = payments.findByIdempotencyKey(purchaseId)
                .orElseThrow(() -> ApiProblem.notFound("Unknown purchase reference."));
        var subscription = payment.getActivatedSubscription() == null ? null
                : SubscriptionSummaryDto.from(payment.getActivatedSubscription());
        return new PurchaseStatusResponse(payment.getIdempotencyKey(), payment.getStatus().name(),
                payment.getFailureReason(), subscription);
    }

    private String normalizePhone(String raw) {
        String phone = raw == null ? "" : raw.replaceAll("[\\s-]", "");
        if (!PHONE_RE.matcher(phone).matches()) {
            throw ApiProblem.badRequest("Validation failed",
                    "Phone must be a valid Tanzanian number in E.164 format (e.g. +255712345678).");
        }
        return phone;
    }
}
