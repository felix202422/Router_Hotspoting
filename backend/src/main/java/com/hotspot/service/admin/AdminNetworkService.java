package com.hotspot.service.admin;

import com.hotspot.common.ApiProblem;
import com.hotspot.common.AuditService;
import com.hotspot.domain.ActiveSession;
import com.hotspot.integration.hotspot.ControllerHealth;
import com.hotspot.integration.hotspot.ControllerSession;
import com.hotspot.integration.hotspot.HotspotController;
import com.hotspot.repository.ActiveSessionRepository;
import com.hotspot.web.dto.admin.NetworkHealthDto;
import com.hotspot.web.dto.admin.NetworkSessionDto;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A27–A29 — controller-backed facts only (FR-D06): no fabricated sessions. */
@Service
public class AdminNetworkService {

    private final HotspotController controller;
    private final ActiveSessionRepository sessions;
    private final AuditService audit;

    public AdminNetworkService(HotspotController controller, ActiveSessionRepository sessions, AuditService audit) {
        this.controller = controller;
        this.sessions = sessions;
        this.audit = audit;
    }

    public NetworkHealthDto health() {
        ControllerHealth health = controller.health();
        String name = controller.name();
        return new NetworkHealthDto(controller.enforcementActive(),
                "NULL".equals(name) ? "NONE" : name,
                health.reachable(), health.lastSyncAt(), health.drift());
    }

    /** Live sessions come from the controller; DB rows only add business context. */
    @Transactional(readOnly = true)
    public List<NetworkSessionDto> listSessions() {
        Instant now = Instant.now();
        List<ControllerSession> reported;
        try {
            reported = controller.listSessions();
        } catch (RuntimeException e) {
            // Honest failure: never substitute made-up sessions when the controller is down.
            throw ApiProblem.unprocessable("Controller unavailable",
                    "The hotspot controller did not answer the session query.");
        }
        if (reported == null || reported.isEmpty()) {
            return List.of();
        }
        return reported.stream().map(session -> {
            ActiveSession row = sessions.findByControllerSessionId(session.grantRef()).orElse(null);
            Long subscriptionId = null;
            String phone = "Unknown";
            String packageName = "Unknown";
            if (row != null) {
                subscriptionId = row.getSubscription().getId();
                phone = row.getSubscription().getCustomer().getPhoneE164();
                packageName = row.getSubscription().getPkg().getName();
            }
            long duration = session.connectedAt() == null ? 0
                    : Math.max(0L, Duration.between(session.connectedAt(), now).getSeconds());
            return new NetworkSessionDto(session.grantRef(),
                    session.ipAddress() == null ? "" : session.ipAddress(),
                    session.deviceIdentifier() == null ? "" : session.deviceIdentifier(),
                    phone, subscriptionId, packageName, session.connectedAt(), duration,
                    session.bytesIn(), session.bytesOut(), "CONNECTED");
        }).toList();
    }

    /** A29 — disconnect only a session the controller actually reports. */
    @Transactional
    public void disconnect(String grantRef, String ip) {
        boolean known = controller.listSessions().stream()
                .anyMatch(session -> session.grantRef().equals(grantRef));
        if (!known) {
            throw ApiProblem.notFound("Live session not found on the controller.");
        }
        try {
            controller.disconnect(grantRef);
        } catch (RuntimeException e) {
            throw ApiProblem.unprocessable("Controller unavailable", "Could not disconnect this session.");
        }
        ActiveSession row = sessions.findByControllerSessionId(grantRef).orElse(null);
        sessions.endByGrantRef(grantRef, com.hotspot.domain.EndReason.DISCONNECT, Instant.now());
        Long subscriptionId = row == null ? 0L : row.getSubscription().getId();
        audit.recordAdmin("SESSION_DISCONNECT", "subscription", subscriptionId, null,
                "Disconnected session " + grantRef, ip);
    }
}
