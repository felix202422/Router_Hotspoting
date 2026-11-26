package com.hotspot.web;

import com.hotspot.common.ClientIp;
import com.hotspot.domain.PackageStatus;
import com.hotspot.service.admin.AdminPackageService;
import com.hotspot.web.dto.admin.AdminPackageDto;
import com.hotspot.web.dto.admin.PackageInputDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** A13–A16 — catalogue management; prices never hardcoded in the frontend. */
@RestController
@RequestMapping("/api/v1/admin/packages")
public class AdminPackageController {

    private final AdminPackageService packages;

    public AdminPackageController(AdminPackageService packages) {
        this.packages = packages;
    }

    @GetMapping
    public List<AdminPackageDto> list(@RequestParam(required = false) PackageStatus status) {
        return packages.list(status);
    }

    @PostMapping
    public AdminPackageDto create(@Valid @RequestBody PackageInputDto input, HttpServletRequest request) {
        return packages.create(input, ClientIp.of(request));
    }

    @PutMapping("/{id}")
    public AdminPackageDto update(@PathVariable Long id, @Valid @RequestBody PackageInputDto input,
                                  HttpServletRequest request) {
        return packages.update(id, input, ClientIp.of(request));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<Void> activate(@PathVariable Long id, HttpServletRequest request) {
        packages.setStatus(id, true, ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<Void> deactivate(@PathVariable Long id, HttpServletRequest request) {
        packages.setStatus(id, false, ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }
}
