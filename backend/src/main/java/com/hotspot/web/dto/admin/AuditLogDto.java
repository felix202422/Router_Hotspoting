package com.hotspot.web.dto.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotspot.domain.AuditLog;
import java.time.Instant;

/** A30 — frontend `AuditLog`. `summary` is humanised from the redacted after-json. */
public record AuditLogDto(Long id, String actorType, String actorName, String action,
                          String entityType, Long entityId, String ip,
                          Instant createdAt, String summary) {

    private static final ObjectMapper JSON = new ObjectMapper();

    public static AuditLogDto of(AuditLog log, String actorName) {
        return new AuditLogDto(log.getId(), log.getActorType().name(), actorName, log.getAction(),
                log.getEntityType(), log.getEntityId(), log.getIpAddress(), log.getCreatedAt(),
                humanise(log.getAfterJson()));
    }

    /** AuditService stores strings as JSON strings; strip the quotes for the UI. */
    private static String humanise(String afterJson) {
        if (afterJson == null || afterJson.isBlank()) {
            return "";
        }
        String text = afterJson.trim();
        if (text.length() >= 2 && text.startsWith("\"") && text.endsWith("\"")) {
            try {
                return JSON.readValue(text, String.class);
            } catch (Exception ignored) {
                return text.substring(1, text.length() - 1);
            }
        }
        return text;
    }
}
