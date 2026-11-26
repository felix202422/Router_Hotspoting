package com.hotspot.web.dto.admin;

import java.time.Instant;

/** A27 — controller-backed health; `controller` is NONE for the soft-gate adapter. */
public record NetworkHealthDto(boolean enforcementActive, String controller, boolean reachable,
                               Instant lastSyncAt, int drift) {
}
