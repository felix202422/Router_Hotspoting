package com.hotspot.integration.hotspot;

import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * MikroTik RouterOS adapter placeholder (D-009/D-020: Option B1 committed,
 * implementation lands in Phase 5 together with the on-site hardware).
 * Until then it reports reachable:false and refuses grants — FR-D06 forbids
 * fabricating network state.
 */
@Component
@ConditionalOnProperty(name = "app.hotspot.controller", havingValue = "mikrotik")
public class MikroTikAdapter implements HotspotController {

    private static final Logger log = LoggerFactory.getLogger(MikroTikAdapter.class);

    @Override
    public String name() {
        return "MIKROTIK";
    }

    @Override
    public boolean enforcementActive() {
        return true;
    }

    @Override
    public ControllerHealth health() {
        return new ControllerHealth(false, null, 0);
    }

    @Override
    public GrantResult grantAccess(GrantRequest request) {
        log.warn("MikroTik grant requested before Phase 5 adapter — refusing sub={}", request.subscriptionId());
        return new GrantResult(false, null, "Controller adapter not available yet (Phase 5)");
    }

    @Override
    public void revokeAccess(String grantRef) {
        log.warn("MikroTik revoke requested before Phase 5 adapter — grant={}", grantRef);
    }

    @Override
    public void disconnect(String grantRef) {
        log.warn("MikroTik disconnect requested before Phase 5 adapter — grant={}", grantRef);
    }

    @Override
    public List<ControllerSession> listSessions() {
        return List.of();
    }
}
