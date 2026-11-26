package com.hotspot.integration.hotspot;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * DEV-ONLY in-memory hotspot controller (hotspot.controller=mock).
 * Simulates grants/sessions deterministically so the dashboard and expiry
 * enforcement are exercisable without MikroTik hardware. Production uses
 * MikroTikAdapter (Phase 5, D-009/D-020).
 */
@Component
@ConditionalOnProperty(name = "app.hotspot.controller", havingValue = "mock", matchIfMissing = true)
public class MockHotspotController implements HotspotController {

    private static final Logger log = LoggerFactory.getLogger(MockHotspotController.class);

    private record MockSession(String grantRef, String phoneE164, Instant connectedAt, long bytesIn, long bytesOut) {
    }

    private final Map<String, MockSession> sessions = new ConcurrentHashMap<>();

    @Override
    public String name() {
        return "MOCK";
    }

    @Override
    public boolean enforcementActive() {
        return true;
    }

    @Override
    public ControllerHealth health() {
        return new ControllerHealth(true, Instant.now(), 0);
    }

    @Override
    public GrantResult grantAccess(GrantRequest request) {
        String grantRef = "grant_" + request.subscriptionId();
        sessions.compute(grantRef, (k, existing) -> existing != null
                ? existing
                : new MockSession(k, request.phoneE164(), Instant.now(), 0L, 0L));
        log.info("MOCK grant issued sub={} grant={}", request.subscriptionId(), grantRef);
        return new GrantResult(true, grantRef, null);
    }

    @Override
    public void revokeAccess(String grantRef) {
        if (sessions.remove(grantRef) != null) {
            log.info("MOCK grant revoked grant={}", grantRef);
        }
    }

    @Override
    public void disconnect(String grantRef) {
        MockSession removed = sessions.remove(grantRef);
        if (removed != null) {
            log.info("MOCK session disconnected grant={}", grantRef);
        }
    }

    @Override
    public List<ControllerSession> listSessions() {
        List<ControllerSession> out = new ArrayList<>();
        for (MockSession s : sessions.values()) {
            out.add(new ControllerSession(s.grantRef(), "10.10.0." + (Math.abs(s.grantRef().hashCode()) % 250 + 2),
                    "mock-dev-" + Math.abs(s.grantRef().hashCode() % 1000), s.connectedAt(), s.bytesIn(), s.bytesOut()));
        }
        return out;
    }
}
