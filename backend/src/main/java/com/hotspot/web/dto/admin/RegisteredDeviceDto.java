package com.hotspot.web.dto.admin;

import com.hotspot.domain.RegisteredDevice;
import java.time.Instant;

/** Frontend `RegisteredDevice` (no fingerprint/MAC beyond the weak hint). */
public record RegisteredDeviceDto(Long id, String deviceLabel, String macHint, String status, Instant boundAt) {

    public static RegisteredDeviceDto from(RegisteredDevice device) {
        return new RegisteredDeviceDto(device.getId(), device.getDeviceLabel(), device.getMacHint(),
                device.getStatus().name(), device.getBoundAt());
    }
}
