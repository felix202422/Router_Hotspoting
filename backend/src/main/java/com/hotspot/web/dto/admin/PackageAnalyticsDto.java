package com.hotspot.web.dto.admin;

/** A24 — most-purchased packages with revenue share (1 decimal). */
public record PackageAnalyticsDto(Long packageId, String packageName, long purchases,
                                  long revenueTzs, double sharePercent) {
}
