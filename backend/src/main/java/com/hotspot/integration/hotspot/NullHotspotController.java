package com.hotspot.integration.hotspot;

import java.time.Instant;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Option A soft-gate controller (hotspot.controller=null): access is recorded
 * but not enforced — the dashboard must show "Enforcement: OFF" honestly
 * (network-architecture-options.md).
 */
@Component
@ConditionalOnProperty(name = "app.hotspot.controller", havingValue = "null")
public class NullHotspotController implements HotspotController {

    @Override
    public String name() {
        return "NULL";
    }

    @Override
    public boolean enforcementActive() {
        return false;
    }

    @Override
    public ControllerHealth health() {
        return new ControllerHealth(true, Instant.now(), 0);
    }

    @Override
    public GrantResult grantAccess(GrantRequest request) {
        // Recorded by the caller; nothing is enforced (soft gate).
        return new GrantResult(true, "grant_" + request.subscriptionId(), null);
    }

    @Override
    public void revokeAccess(String grantRef) {
        // no-op by design
    }

    @Override
    public void disconnect(String grantRef) {
        // no-op by design
    }

    @Override
    public List<ControllerSession> listSessions() {
        return List.of();
    }
}
