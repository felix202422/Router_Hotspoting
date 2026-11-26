package com.hotspot.web.dto;

/**
 * P7 request — token authenticates (generic 401 when blank/invalid via the
 * service), reason is checked in the service so no token detail leaks via 400.
 */
public record DeviceReplacementInput(String token, String reason, String newDeviceHint) {
}
