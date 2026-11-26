package com.hotspot.integration.hotspot;

import java.time.Instant;

/** What the business layer asks the controller to grant (rate profile from the package). */
public record GrantRequest(
        Long subscriptionId,
        String phoneE164,
        Instant validUntil,
        Integer maxDownloadKbps,
        Integer maxUploadKbps,
        Integer deviceLimit) {
}
