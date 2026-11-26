package com.hotspot.web;

import com.hotspot.common.Paging;
import com.hotspot.service.admin.AdminAuditService;
import com.hotspot.web.dto.admin.AuditLogDto;
import com.hotspot.web.dto.admin.PagedDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** A30 — read-only, 1-based paged audit log (FR-A06). */
@RestController
@RequestMapping("/api/v1/admin/audit-logs")
public class AdminAuditController {

    private final AdminAuditService logs;

    public AdminAuditController(AdminAuditService logs) {
        this.logs = logs;
    }

    @GetMapping
    public PagedDto<AuditLogDto> list(@RequestParam(required = false) String actor,
                                      @RequestParam(required = false) String action,
                                      @RequestParam(required = false) String entityType,
                                      @RequestParam(required = false) String from,
                                      @RequestParam(required = false) String to,
                                      @RequestParam(defaultValue = "1") int page,
                                      @RequestParam(defaultValue = "25") int size) {
        return logs.list(actor, action, entityType, from, to, Paging.page(page), Paging.size(size));
    }
}
