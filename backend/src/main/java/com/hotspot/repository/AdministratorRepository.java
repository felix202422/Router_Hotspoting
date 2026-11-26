package com.hotspot.repository;

import com.hotspot.domain.Administrator;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdministratorRepository extends JpaRepository<Administrator, Long> {

    Optional<Administrator> findByEmail(String email);

    boolean existsByEmail(String email);
}
