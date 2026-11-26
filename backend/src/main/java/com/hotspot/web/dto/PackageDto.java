package com.hotspot.web.dto;

import com.hotspot.domain.Package;

/** P1 — mirrors the frontend `Package` type (activeSubscriberCount is admin-only). */
public record PackageDto(
        Long id,
        String name,
        String description,
        Long priceTzs,
        Integer durationSeconds,
        Long dataAllowanceBytes,
        Integer maxDownloadKbps,
        Integer maxUploadKbps,
        Integer deviceLimit,
        String status,
        Integer sortOrder) {

    public static PackageDto from(Package pkg) {
        return new PackageDto(pkg.getId(), pkg.getName(), pkg.getDescription(), pkg.getPriceTzs(),
                pkg.getDurationSeconds(), pkg.getDataAllowanceBytes(), pkg.getMaxDownloadKbps(),
                pkg.getMaxUploadKbps(), pkg.getDeviceLimit(), pkg.getStatus().name(), pkg.getSortOrder());
    }
}
