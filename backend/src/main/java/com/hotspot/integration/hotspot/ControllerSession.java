package com.hotspot.integration.hotspot;

import java.time.Instant;

/** Controller-reported live session (raw network facts only — business enrichment happens in the service layer). */
public record ControllerSession(
        String grantRef,
        String ipAddress,
        String deviceIdentifier,
        Instant connectedAt,
        long bytesIn,
        long bytesOut) {
}
