package com.hotspot.integration.hotspot;

import java.time.Instant;
import java.util.List;

/**
 * Hotspot controller SPI (D-010, hotspot-adapter-design.md) — business logic
 * never touches vendor APIs. Selected by app.hotspot.controller:
 * mikrotik (Phase 5) | mock (dev) | null (Option A soft-gate).
 */
public interface HotspotController {

    /** MIKROTIK | MOCK | NULL — surfaced by GET /admin/network/health. */
    String name();

    /** Option A = false (soft gate, dashboard shows "Enforcement: OFF"). */
    boolean enforcementActive();

    ControllerHealth health();

    GrantResult grantAccess(GrantRequest request);

    void revokeAccess(String grantRef);

    void disconnect(String grantRef);

    /** Live sessions from the controller — [] with reachable:false when offline (FR-D06). */
    List<ControllerSession> listSessions();
}
