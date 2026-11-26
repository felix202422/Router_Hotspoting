package com.hotspot.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** A1 request body: {email, password}. */
public record LoginRequest(
        @NotBlank(message = "is required")
        @Email(message = "must be a valid email")
        String email,
        @NotBlank(message = "is required")
        String password) {
}
