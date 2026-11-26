package com.hotspot.web.dto;

import com.hotspot.domain.Administrator;

/**
 * A1/A2 response — field names mirror the frontend contract exactly
 * (`AuthResponse` in frontend/src/types/index.ts): accessToken, refreshToken,
 * expiresIn (seconds), profile {id, email, fullName, role}.
 */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        long expiresIn,
        ProfileDto profile) {

    public static AuthResponse of(Administrator admin, String accessToken, String refreshToken, long expiresIn) {
        return new AuthResponse(accessToken, refreshToken, expiresIn, ProfileDto.from(admin));
    }
}
