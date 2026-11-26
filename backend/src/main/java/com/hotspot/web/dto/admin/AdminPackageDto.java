package com.hotspot.web.dto.admin;

import com.hotspot.domain.Package;

/** Frontend `Package` incl. admin-only `activeSubscriberCount` (A13–A16). */
public record AdminPackageDto(Long id, String name, String description, Long priceTzs,
                              Integer durationSeconds, Long dataAllowanceBytes,
                              Integer maxDownloadKbps, Integer maxUploadKbps,
                              Integer deviceLimit, String status, Integer sortOrder,
                              long activeSubscriberCount) {

    public static AdminPackageDto of(Package pkg, long activeSubscriberCount) {
        return new AdminPackageDto(pkg.getId(), pkg.getName(), pkg.getDescription(), pkg.getPriceTzs(),
                pkg.getDurationSeconds(), pkg.getDataAllowanceBytes(), pkg.getMaxDownloadKbps(),
                pkg.getMaxUploadKbps(), pkg.getDeviceLimit(), pkg.getStatus().name(),
                pkg.getSortOrder(), activeSubscriberCount);
    }
}
