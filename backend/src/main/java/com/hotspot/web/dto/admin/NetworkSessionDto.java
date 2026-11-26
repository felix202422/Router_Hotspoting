package com.hotspot.web.dto.admin;

import java.time.Instant;

/** A28 — controller-reported facts + DB business context (never fabricated). */
public record NetworkSessionDto(String grantRef, String ipAddress, String deviceIdentifier,
                                String phoneE164, Long subscriptionId, String packageName,
                                Instant connectedAt, long durationSeconds,
                                long bytesIn, long bytesOut, String state) {
}
