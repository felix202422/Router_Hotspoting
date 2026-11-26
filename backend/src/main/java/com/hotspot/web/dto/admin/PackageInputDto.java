package com.hotspot.web.dto.admin;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Frontend `PackageInput` (A14/A15); prices/durations come from the admin, never hardcoded. */
public record PackageInputDto(
        @NotBlank String name,
        String description,
        @NotNull @Positive Long priceTzs,
        @NotNull @Positive Integer durationSeconds,
        Long dataAllowanceBytes,
        Integer maxDownloadKbps,
        Integer maxUploadKbps,
        @NotNull @Min(1) Integer deviceLimit,
        @NotBlank String status,
        @NotNull Integer sortOrder) {
}
