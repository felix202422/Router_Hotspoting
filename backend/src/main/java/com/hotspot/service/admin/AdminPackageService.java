package com.hotspot.service.admin;

import com.hotspot.common.ApiProblem;
import com.hotspot.common.AuditService;
import com.hotspot.domain.Package;
import com.hotspot.domain.PackageStatus;
import com.hotspot.repository.PackageRepository;
import com.hotspot.repository.SubscriptionRepository;
import com.hotspot.web.dto.admin.AdminPackageDto;
import com.hotspot.web.dto.admin.PackageInputDto;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A13–A16: package catalogue. Prices/limits come from the admin, never the frontend bundle. */
@Service
public class AdminPackageService {

    private final PackageRepository packages;
    private final SubscriptionRepository subscriptions;
    private final AuditService audit;

    public AdminPackageService(PackageRepository packages, SubscriptionRepository subscriptions, AuditService audit) {
        this.packages = packages;
        this.subscriptions = subscriptions;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<AdminPackageDto> list(PackageStatus status) {
        List<Package> rows = status == null
                ? packages.findAllByOrderBySortOrderAsc()
                : packages.findByStatusOrderBySortOrder(status);
        return rows.stream().map(pkg -> AdminPackageDto.of(pkg,
                subscriptions.countActiveByPackageId(pkg.getId(), Instant.now()))).toList();
    }

    @Transactional
    public AdminPackageDto create(PackageInputDto input, String ip) {
        Package pkg = new Package();
        apply(input, pkg);
        Package saved = packages.save(pkg);
        audit.recordAdmin("PACKAGE_CREATE", "package", saved.getId(), null,
                "Created package \"" + saved.getName() + "\"", ip);
        return AdminPackageDto.of(saved, 0L);
    }

    @Transactional
    public AdminPackageDto update(Long id, PackageInputDto input, String ip) {
        Package pkg = find(id);
        String before = pkg.getName() + " / TZS " + pkg.getPriceTzs() + " / " + pkg.getDurationSeconds() + "s";
        apply(input, pkg);
        Package saved = packages.save(pkg);
        audit.recordAdmin("PACKAGE_UPDATE", "package", id, before,
                saved.getName() + " / TZS " + saved.getPriceTzs() + " / " + saved.getDurationSeconds() + "s", ip);
        return AdminPackageDto.of(saved, subscriptions.countActiveByPackageId(id, Instant.now()));
    }

    @Transactional
    public void setStatus(Long id, boolean active, String ip) {
        Package pkg = find(id);
        String before = pkg.getStatus().name();
        pkg.setStatus(active ? PackageStatus.ACTIVE : PackageStatus.INACTIVE);
        packages.save(pkg);
        audit.recordAdmin("PACKAGE_STATUS", "package", id, before, pkg.getStatus().name(), ip);
    }

    private Package find(Long id) {
        return packages.findById(id)
                .orElseThrow(() -> ApiProblem.notFound("Package not found."));
    }

    private void apply(PackageInputDto input, Package pkg) {
        PackageStatus status;
        try {
            status = PackageStatus.valueOf(input.status().trim().toUpperCase());
        } catch (RuntimeException e) {
            throw ApiProblem.badRequest("Validation failed", "status must be ACTIVE or INACTIVE.");
        }
        pkg.setName(input.name().trim());
        pkg.setDescription(input.description());
        pkg.setPriceTzs(input.priceTzs());
        pkg.setDurationSeconds(input.durationSeconds());
        pkg.setDataAllowanceBytes(input.dataAllowanceBytes());
        pkg.setMaxDownloadKbps(input.maxDownloadKbps());
        pkg.setMaxUploadKbps(input.maxUploadKbps());
        pkg.setDeviceLimit(input.deviceLimit());
        pkg.setStatus(status);
        pkg.setSortOrder(input.sortOrder());
    }
}
