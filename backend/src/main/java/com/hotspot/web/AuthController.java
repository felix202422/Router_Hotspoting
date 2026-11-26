package com.hotspot.web;

import com.hotspot.security.JwtService.AdminClaim;
import com.hotspot.service.AdminAuthService;
import com.hotspot.web.dto.AuthResponse;
import com.hotspot.web.dto.LoginRequest;
import com.hotspot.web.dto.ProfileDto;
import com.hotspot.web.dto.RefreshRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin auth endpoints (api-contract §5):
 *   A1 POST /admin/auth/login    — public, rate-limited 5/min per IP
 *   A2 POST /admin/auth/refresh  — public, rotates the refresh token
 *   A3 POST /admin/auth/logout   — public, idempotent revocation
 *   A4 GET  /admin/auth/me       — requires ROLE_ADMIN (default-deny covers it)
 * SecurityConfig already permits exactly login/refresh/logout; everything else
 * under /api/v1/admin/** needs a valid access token.
 */
@RestController
@RequestMapping("/api/v1/admin/auth")
public class AuthController {

    private final AdminAuthService authService;

    public AuthController(AdminAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return authService.login(request.email(), request.password(), clientIp(http));
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request, HttpServletRequest http) {
        return authService.refresh(request.refreshToken(), clientIp(http));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest request, HttpServletRequest http) {
        authService.logout(request.refreshToken(), clientIp(http));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ProfileDto me() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        AdminClaim claim = (AdminClaim) authentication.getPrincipal();
        return authService.me(claim);
    }

    /**
     * Client IP for rate limiting/audit. Behind the Phase 7 nginx proxy the
     * direct peer is the proxy, so the first X-Forwarded-For entry wins;
     * locally (no proxy) remoteAddr is used. XFF is only trusted because
     * production puts nginx in front (D-005) — never expose the app directly.
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
