package com.hotspot.service.admin;

import com.hotspot.common.TzDates;
import com.hotspot.domain.ActorType;
import com.hotspot.domain.AuditLog;
import com.hotspot.repository.AdministratorRepository;
import com.hotspot.repository.AuditLogRepository;
import com.hotspot.web.dto.admin.AuditLogDto;
import com.hotspot.web.dto.admin.PagedDto;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A30 — read-only audit trail with filters and 1-based paging. */
@Service
public class AdminAuditService {

    private final AuditLogRepository logs;
    private final AdministratorRepository administrators;

    public AdminAuditService(AuditLogRepository logs, AdministratorRepository administrators) {
        this.logs = logs;
        this.administrators = administrators;
    }

    @Transactional(readOnly = true)
    public PagedDto<AuditLogDto> list(String actor, String action, String entityType,
                                      String from, String to, int page, int size) {
        Instant[] range = (from == null && to == null) ? null : TzDates.range(
                from == null ? "2000-01-01" : from,
                to == null ? "2100-12-31" : to);
        Specification<AuditLog> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (actor != null && !actor.isBlank()) {
                try {
                    predicates.add(cb.equal(root.get("actorType"), ActorType.valueOf(actor.trim().toUpperCase())));
                } catch (IllegalArgumentException e) {
                    predicates.add(cb.disjunction()); // unknown actor → no rows, no error leak
                }
            }
            if (action != null && !action.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("action")),
                        "%" + action.trim().toLowerCase() + "%"));
            }
            if (entityType != null && !entityType.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("entityType")), entityType.trim().toLowerCase()));
            }
            if (range != null) {
                predicates.add(cb.between(root.get("createdAt"), range[0], range[1]));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Page<AuditLog> result = logs.findAll(spec, PageRequest.of(page - 1, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        Set<Long> actorIds = result.getContent().stream()
                .filter(row -> row.getActorType() == ActorType.ADMIN && row.getActorId() != null)
                .map(AuditLog::getActorId).collect(Collectors.toSet());
        Map<Long, String> names = actorIds.isEmpty() ? Map.of() : administrators.findAllById(actorIds).stream()
                .collect(Collectors.toMap(a -> a.getId(), a -> a.getFullName(), (a, b) -> a));
        List<AuditLogDto> items = result.getContent().stream()
                .map(row -> AuditLogDto.of(row, row.getActorType() == ActorType.ADMIN
                        ? names.getOrDefault(row.getActorId(), "Administrator #" + row.getActorId())
                        : "System"))
                .toList();
        return new PagedDto<>(items, result.getNumber() + 1, result.getSize(), result.getTotalElements());
    }
}
