package com.hotspot.web.dto;

import com.hotspot.domain.ReplacementStatus;

/** P7 response — mirrors frontend `DeviceReplacementRequest`. */
public record DeviceReplacementResponse(
        Long requestId,
        ReplacementStatus status,
        String message) {
}
