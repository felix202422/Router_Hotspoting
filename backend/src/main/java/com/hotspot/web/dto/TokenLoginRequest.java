package com.hotspot.web.dto;

/**
 * P5 request — the raw token from the SMS plus an optional browser device hint.
 * A blank token is deliberately NOT rejected by bean validation: TokenService
 * turns every missing/invalid token into the same generic 401 (FR-C11).
 */
public record TokenLoginRequest(String token, String deviceHint) {
}
