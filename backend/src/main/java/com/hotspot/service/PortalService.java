package com.hotspot.service;

import com.hotspot.common.ApiProblem;
import com.hotspot.common.RateLimitService;
import com.hotspot.domain.DeviceStatus;
import com.hotspot.domain.RegisteredDevice;
import com.hotspot.domain.ReplacementStatus;
import com.hotspot.domain.Subscription;
import com.hotspot.repository.DeviceReplacementRepository;
import com.hotspot.repository.PackageRepository;
import com.hotspot.repository.RegisteredDeviceRepository;
import com.hotspot.security.JwtService;
import com.hotspot.service.TokenService.AuthenticatedToken;
import com.hotspot.web.dto.DeviceReplacementInput;
import com.hotspot.web.dto.DeviceReplacementResponse;
import com.hotspot.web.dto.PackageDto;
import com.hotspot.web.dto.SubscriptionInfoDto;
import com.hotspot.web.dto.SubscriptionSummaryDto;
import com.hotspot.web.dto.TokenLoginResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public customer-portal core (contract P1/P5/P6/P7).
 *
 * Security invariants: no access before a verified payment (P5/P6/P7 all go
 * through {@link TokenService#validate}, which requires ACTIVE+unexpired), no
 * OTP anywhere (D-006), device binding lives in registered_devices (D-016),
 * and package data comes from the DB only (FR-C02).
 */
@Service
public class PortalService {

    private final PackageRepository packages;
    private final DeviceReplacementRepository replacements;
    private final RegisteredDeviceRepository devices;
    private final TokenService tokenService;
    private final SubscriptionService subscriptionService;
    private final RateLimitService rateLimiter;

    public PortalService(PackageRepository packages,
                         DeviceReplacementRepository replacements,
                         RegisteredDeviceRepository devices,
                         TokenService tokenService,
                         SubscriptionService subscriptionService,
                         RateLimitService rateLimiter) {
        this.packages = packages;
        this.replacements = replacements;
        this.devices = devices;
        this.tokenService = tokenService;
        this.subscriptionService = subscriptionService;
        this.rateLimiter = rateLimiter;
    }

    /** P1 — active packages, ordered by the admin-controlled sort order. */
    public List<PackageDto> activePackages() {
        return packages.findByStatusOrderBySortOrder(com.hotspot.domain.PackageStatus.ACTIVE)
                .stream().map(PackageDto::from).toList();
    }

    /**
     * P5 — token login: generic 401 for every invalid-token reason (FR-C11),
     * 5/min per IP + token prefix (the token stands in for the phone because
     * the phone is never sent in this request), 409 for a device mismatch.
     * First login binds the device; a live session is ensured through the
     * controller (never a fabricated session — FR-D06).
     */
    @Transactional
    public TokenLoginResponse tokenLogin(String rawToken, String deviceHint, String ipAddress) {
        String tokenPrefix = JwtService.sha256Hex(rawToken).substring(0, 12);
        String bucket = "token-login:" + ipAddress + ":" + tokenPrefix;
        RateLimitService.Decision decision = rateLimiter.tryAcquire(bucket, 5, Duration.ofMinutes(1));
        if (!decision.allowed()) {
            throw ApiProblem.tooManyRequests("Too many attempts",
                    "Too many attempts. Try again in " + decision.retryAfterSeconds() + " seconds.",
                    decision.retryAfterSeconds());
        }

        AuthenticatedToken auth = tokenService.validate(rawToken); // generic 401
        Subscription subscription = auth.subscription();
        String hint = deviceHint == null || deviceHint.isBlank() ? null : deviceHint.trim();

        List<RegisteredDevice> bound = devices.findBySubscriptionIdAndStatus(
                subscription.getId(), DeviceStatus.ACTIVE);
        RegisteredDevice current = bound.isEmpty() ? null : bound.get(0);
        if (hint != null) {
            if (current != null && !hint.equals(current.getDeviceFingerprint())) {
                throw ApiProblem.conflict("Different device detected",
                        "This access token is bound to another device. Request a device replacement from support.");
            }
            if (current == null) {
                // First login binds the device (FR-S01). deviceLimit is a package
                // property (FR-C02) — a brand-new binding always fits.
                RegisteredDevice device = new RegisteredDevice();
                device.setSubscription(subscription);
                device.setDeviceFingerprint(hint);
                device.setStatus(DeviceStatus.ACTIVE);
                device.setBoundAt(Instant.now());
                devices.save(device);
                current = device;
            }
        }

        Instant boundAt = subscriptionService.ensureLiveSession(subscription);
        // A successful login clears the failure counter, as in A1.
        rateLimiter.reset(bucket);

        return new TokenLoginResponse(
                SubscriptionSummaryDto.from(subscription),
                new TokenLoginResponse.Session("CONNECTED", boundAt));
    }

    /** P6 — subscription + device registration status for a validated token. */
    @Transactional(readOnly = true)
    public SubscriptionInfoDto currentSubscription(String rawToken) {
        AuthenticatedToken auth = tokenService.validate(rawToken);
        Subscription subscription = auth.subscription();
        List<RegisteredDevice> bound = devices.findBySubscriptionIdAndStatus(
                subscription.getId(), DeviceStatus.ACTIVE);
        RegisteredDevice device = bound.isEmpty() ? null : bound.get(0);
        return new SubscriptionInfoDto(
                new SubscriptionInfoDto.CustomerInfo(subscription.getCustomer().getPhoneE164()),
                SubscriptionSummaryDto.from(subscription),
                new SubscriptionInfoDto.DeviceInfo(device != null,
                        device == null ? null : device.getDeviceLabel(),
                        device == null ? null : device.getBoundAt()));
    }

    /** P7 — creates a PENDING replacement request; approval is admin-only (no OTP). */
    @Transactional
    public DeviceReplacementResponse requestReplacement(DeviceReplacementInput input, String ipAddress) {
        AuthenticatedToken auth = tokenService.validate(input.token()); // generic 401
        String reason = input.reason() == null ? "" : input.reason().trim();
        if (reason.length() < 5) {
            throw ApiProblem.badRequest("Validation failed",
                    "Please describe your reason (at least 5 characters).");
        }
        Subscription subscription = auth.subscription();
        List<RegisteredDevice> bound = devices.findBySubscriptionIdAndStatus(
                subscription.getId(), DeviceStatus.ACTIVE);

        com.hotspot.domain.DeviceReplacement request = new com.hotspot.domain.DeviceReplacement();
        request.setCustomer(subscription.getCustomer());
        request.setSubscription(subscription);
        request.setRequestReason(reason);
        request.setOldDeviceLabel(bound.isEmpty() ? null : bound.get(0).getDeviceLabel());
        String newHint = input.newDeviceHint() == null ? null : input.newDeviceHint().trim();
        request.setNewDeviceLabel(newHint == null || newHint.isBlank() ? null : newHint);
        request.setStatus(ReplacementStatus.PENDING);
        com.hotspot.domain.DeviceReplacement saved = replacements.save(request);

        // Audit is best-effort via AuditService's own transaction; here the
        // customer-facing request is created first, so a logging failure cannot
        // hide a successful submission.
        return new DeviceReplacementResponse(saved.getId(), ReplacementStatus.PENDING,
                "Your request is pending administrator approval");
    }
}
