package com.hotspot.web;

import com.hotspot.common.ClientIp;
import com.hotspot.service.PortalService;
import com.hotspot.web.dto.DeviceReplacementInput;
import com.hotspot.web.dto.DeviceReplacementResponse;
import com.hotspot.web.dto.PackageDto;
import com.hotspot.web.dto.SubscriptionInfoDto;
import com.hotspot.web.dto.TokenLoginRequest;
import com.hotspot.web.dto.TokenLoginResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public customer-portal endpoints P1/P5/P6/P7 (api-contract §2).
 * P2/P3/P4 (purchase + webhook) live in PurchaseController/WebhookController.
 *
 * P6/P7 token header: the contract names X-Access-Token; the shipped frontend
 * sends the portal token as `Authorization: Bearer <raw>` (services/http.ts),
 * so both are accepted — the raw portal token is NOT a JWT and the JWT filter
 * simply ignores it (parseAccess returns null).
 */
@RestController
@RequestMapping("/api/v1")
public class PortalController {

    private final PortalService portal;

    public PortalController(PortalService portal) {
        this.portal = portal;
    }

    /** P1 — active packages from the DB only (FR-C02), cacheable 30 s. */
    @GetMapping("/packages")
    public ResponseEntity<List<PackageDto>> packages() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, java.util.concurrent.TimeUnit.SECONDS))
                .body(portal.activePackages());
    }

    /** P5 — reconnect with the SMS token (5/min per IP+token, generic 401). */
    @PostMapping("/auth/token-login")
    public TokenLoginResponse tokenLogin(@Valid @RequestBody TokenLoginRequest request,
                                         HttpServletRequest http) {
        return portal.tokenLogin(request.token(), request.deviceHint(), ClientIp.of(http));
    }

    /** P6 — current subscription for a validated token. */
    @GetMapping("/subscriptions/current")
    public SubscriptionInfoDto current(
            @RequestHeader(value = "X-Access-Token", required = false) String headerToken,
            HttpServletRequest http) {
        return portal.currentSubscription(portalToken(headerToken, http));
    }

    /** P7 — request a device replacement; status PENDING until admin approval. */
    @PostMapping("/device-replacement-requests")
    public ResponseEntity<DeviceReplacementResponse> replacement(
            @Valid @RequestBody DeviceReplacementInput request,
            HttpServletRequest http) {
        // The frontend sends the token in the body and in Authorization; the
        // body is authoritative (contract P7), header is the fallback.
        String token = request.token() != null && !request.token().isBlank()
                ? request.token() : portalToken(null, http);
        DeviceReplacementInput resolved = new DeviceReplacementInput(
                token, request.reason(), request.newDeviceHint());
        return ResponseEntity.status(201).body(portal.requestReplacement(resolved, ClientIp.of(http)));
    }

    private String portalToken(String xAccessToken, HttpServletRequest http) {
        if (xAccessToken != null && !xAccessToken.isBlank()) {
            return xAccessToken.trim();
        }
        String auth = http.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7).trim();
        }
        return null;
    }
}
