package com.hotspot.integration.hotspot;

import java.time.Instant;

/**
 * @param reachable   controller answered the last probe
 * @param lastSyncAt  when sessions were last synchronised (null = never)
 * @param drift       number of grants the DB and controller disagree on
 */
public record ControllerHealth(boolean reachable, Instant lastSyncAt, int drift) {
}
