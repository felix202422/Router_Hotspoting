package com.hotspot.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** P2 request — phone in E.164 and a package id from the DB (FR-C02). */
public record PurchaseRequest(
        @NotBlank(message = "Phone number is required") String phone,
        @NotNull(message = "Package is required") Long packageId) {
}
