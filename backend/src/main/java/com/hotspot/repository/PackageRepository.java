package com.hotspot.repository;

import com.hotspot.domain.Package;
import com.hotspot.domain.PackageStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PackageRepository extends JpaRepository<Package, Long> {

    List<Package> findByStatusOrderBySortOrder(PackageStatus status);

    List<Package> findAllByOrderBySortOrderAsc();

    long countByStatus(PackageStatus status);
}
