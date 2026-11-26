package com.hotspot.web.dto;

import jakarta.validation.constraints.NotBlank;

/** A2/A3 request body: {refreshToken} — rotation on refresh, revocation on logout. */
public record RefreshRequest(
        @NotBlank(message = "is required")
        String refreshToken) {
}
