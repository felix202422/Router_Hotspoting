package com.hotspot.web.dto.admin;

import com.hotspot.domain.DeviceReplacement;
import java.time.Instant;

/** Frontend `Replacement` (A10 queue). `reason` maps to request_reason. */
public record ReplacementDto(Long id, Long customerId, String phoneE164, Long subscriptionId,
                             String reason, String oldDeviceLabel, String newDeviceLabel,
                             String status, String reviewedBy, Instant reviewedAt,
                             String rejectionReason, Instant createdAt) {

    public static ReplacementDto from(DeviceReplacement row, String reviewerName) {
        return new ReplacementDto(row.getId(), row.getCustomer().getId(), row.getCustomer().getPhoneE164(),
                row.getSubscription().getId(), row.getRequestReason(), row.getOldDeviceLabel(),
                row.getNewDeviceLabel(), row.getStatus().name(), reviewerName, row.getReviewedAt(),
                row.getRejectionReason(), row.getCreatedAt());
    }
}
