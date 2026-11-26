package com.hotspot.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotspot.common.ApiProblem;
import com.hotspot.common.RateLimitService;
import com.hotspot.domain.Payment;
import com.hotspot.domain.WebhookEvent;
import com.hotspot.domain.WebhookStatus;
import com.hotspot.integration.payment.PaymentProvider;
import com.hotspot.repository.PaymentRepository;
import com.hotspot.repository.WebhookEventRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * P4 — verifies, records and deduplicates incoming provider callbacks before
 * calling the shared idempotent result core ({@link PaymentWebhookService}).
 *
 * Order is security-critical (FR-M02/M03): rate limit → IP allowlist → signature
 * → parse → replay guard → persist event → process. Nothing touches payment or
 * subscription state until the signature has passed. The event row is written
 * in its own REQUIRES_NEW transaction, so a processing failure cannot hide the
 * callback and a duplicate race cannot poison this transaction.
 *
 * The provider adapter maps vendor JSON into {@link Envelope}; Daraja remains
 * fail-closed until Phase 5 (D-003), while the dev mock uses the same HMAC
 * secret from the environment (D-029). No secret or raw signature is logged.
 */
@Service
public class PaymentWebhookIngestionService {

    private static final Logger log = LoggerFactory.getLogger(PaymentWebhookIngestionService.class);

    /** Provider-agnostic callback envelope — secrets are never part of it. */
    public record Envelope(String eventId, String purchaseId, Boolean success,
                           String failureReason, String providerReference) {
    }

    public record Result(WebhookStatus status) {
    }

    private final PaymentProvider provider;
    private final RateLimitService rateLimiter;
    private final ObjectMapper json;
    private final WebhookEventRepository events;
    private final PaymentRepository payments;
    private final PaymentWebhookService processor;
    private final TransactionTemplate eventTx;
    private final String allowedIps;

    public PaymentWebhookIngestionService(PaymentProvider provider,
                                          RateLimitService rateLimiter,
                                          ObjectMapper json,
                                          WebhookEventRepository events,
                                          PaymentRepository payments,
                                          PaymentWebhookService processor,
                                          PlatformTransactionManager transactionManager,
                                          @Value("${app.security.webhook-allowed-ips:}") String allowedIps) {
        this.provider = provider;
        this.rateLimiter = rateLimiter;
        this.json = json;
        this.events = events;
        this.payments = payments;
        this.processor = processor;
        this.allowedIps = allowedIps;
        this.eventTx = new TransactionTemplate(transactionManager);
        this.eventTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** P4 — returns PROCESSED for a newly accepted result, IGNORED for a replay. */
    public Result ingest(String rawBody, String signatureHeader, String ipAddress) {
        RateLimitService.Decision limit = rateLimiter.tryAcquire("webhook:" + ipAddress, 100,
                Duration.ofMinutes(1));
        if (!limit.allowed()) {
            throw ApiProblem.tooManyRequests("Too many attempts",
                    "Too many webhook attempts from this address.", limit.retryAfterSeconds());
        }
        if (!ipAllowed(ipAddress)) {
            log.warn("Webhook from non-allowlisted address rejected");
            throw ApiProblem.unauthorized("Webhook source not allowed");
        }
        if (signatureHeader == null || signatureHeader.isBlank()
                || !provider.verifySignature(rawBody == null ? "" : rawBody, signatureHeader)) {
            // Never log the header or body — a forged signature must not reach logs.
            log.warn("Webhook with invalid signature rejected (provider={})", provider.name());
            throw ApiProblem.unauthorized("Invalid webhook signature");
        }

        Envelope envelope = parse(rawBody);
        if (events.existsByProviderAndProviderEventId(provider.name(), envelope.eventId())) {
            log.info("Webhook replay ignored provider={} event={}", provider.name(), envelope.eventId());
            return new Result(WebhookStatus.IGNORED);
        }

        Payment payment = payments.findByIdempotencyKey(envelope.purchaseId()).orElse(null);
        WebhookEvent event = new WebhookEvent();
        event.setProvider(provider.name());
        event.setProviderEventId(envelope.eventId());
        event.setPayment(payment); // nullable — unknown purchases are still recorded
        event.setSignatureValid(true);
        // The stored payload comes from the verified adapter envelope (no secrets);
        // Phase 5 maps vendor payloads to this shape before storage (D-029).
        event.setPayload(rawBody);
        event.setProcessingStatus(WebhookStatus.RECEIVED);

        try {
            eventTx.executeWithoutResult(status -> events.saveAndFlush(event));
        } catch (DataIntegrityViolationException duplicate) {
            // Concurrent delivery of the same event id: UNIQUE(provider,event_id) wins.
            log.info("Webhook duplicate event ignored provider={} event={}",
                    provider.name(), envelope.eventId());
            return new Result(WebhookStatus.IGNORED);
        }

        WebhookStatus outcome = payment == null ? WebhookStatus.IGNORED : WebhookStatus.PROCESSED;
        try {
            if (payment != null) {
                // Separate bean → @Transactional on the shared core is honoured.
                processor.processVerifiedResult(envelope.purchaseId(), envelope.providerReference(),
                        Boolean.TRUE.equals(envelope.success()), envelope.failureReason());
            } else {
                log.warn("Webhook for unknown purchase {} recorded but not applied", envelope.purchaseId());
            }
            event.setProcessingStatus(outcome);
        } catch (RuntimeException e) {
            event.setProcessingStatus(WebhookStatus.ERROR);
            log.error("Webhook processing failed provider={} event={}", provider.name(),
                    envelope.eventId(), e);
            throw e; // 500 → provider retries; the ERROR row remains for support
        } finally {
            event.setProcessedAt(Instant.now());
            eventTx.executeWithoutResult(status -> events.save(event));
        }
        return new Result(outcome);
    }

    private Envelope parse(String rawBody) {
        Envelope envelope;
        try {
            envelope = json.readValue(rawBody == null ? "" : rawBody, Envelope.class);
        } catch (JsonProcessingException e) {
            throw ApiProblem.badRequest("Invalid webhook payload", "Webhook body is not valid JSON.");
        }
        if (envelope == null || envelope.eventId() == null || envelope.eventId().isBlank()
                || envelope.purchaseId() == null || envelope.purchaseId().isBlank()
                || envelope.success() == null) {
            throw ApiProblem.badRequest("Invalid webhook payload",
                    "Webhook requires eventId, purchaseId and success.");
        }
        return envelope;
    }

    private boolean ipAllowed(String ipAddress) {
        if (allowedIps == null || allowedIps.isBlank()) {
            return true; // dev default; production sets WEBHOOK_ALLOWED_IPS
        }
        return Arrays.stream(allowedIps.split(","))
                .map(String::trim)
                .anyMatch(entry -> !entry.isEmpty() && MessageDigest.isEqual(
                        entry.getBytes(StandardCharsets.UTF_8),
                        ipAddress == null ? new byte[0] : ipAddress.getBytes(StandardCharsets.UTF_8)));
    }
}
