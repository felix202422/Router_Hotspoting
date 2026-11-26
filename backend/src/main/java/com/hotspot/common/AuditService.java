package com.hotspot.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotspot.domain.ActorType;
import com.hotspot.domain.AuditLog;
import com.hotspot.repository.AuditLogRepository;
import com.hotspot.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Audit trail writer (§15, FR-A06): every admin mutation is recorded with
 * actor, action, entity and a redacted before/after JSON diff.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /** Administrator currently authenticated in this request (null for system flows). */
    public Long currentAdminId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof JwtService.AdminClaim claim) {
            return claim.uid();
        }
        return null;
    }

    public void record(ActorType actorType, Long actorId, String action,
                       String entityType, Long entityId,
                       Object before, Object after, String ipAddress) {
        try {
            AuditLog entry = new AuditLog();
            entry.setActorType(actorType);
            entry.setActorId(actorId);
            entry.setAction(action);
            entry.setEntityType(entityType);
            entry.setEntityId(entityId);
            entry.setBeforeJson(toJson(before));
            entry.setAfterJson(toJson(after));
            entry.setIpAddress(ipAddress);
            repository.save(entry);
        } catch (RuntimeException e) {
            // The audited action itself must not fail because of logging problems.
            log.error("Failed to write audit entry action={} entity={}#{}", action, entityType, entityId, e);
        }
    }

    /** Convenience for admin mutations: actor from the security context. */
    public void recordAdmin(String action, String entityType, Long entityId,
                            Object before, Object after, String ipAddress) {
        record(ActorType.ADMIN, currentAdminId(), action, entityType, entityId, before, after, ipAddress);
    }

    /** Convenience for scheduled/system actions. */
    public void recordSystem(String action, String entityType, Long entityId, Object after) {
        record(ActorType.SYSTEM, null, action, entityType, entityId, null, after, null);
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return "\"<unserializable>\"";
        }
    }
}
