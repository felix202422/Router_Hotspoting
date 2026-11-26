package com.hotspot.repository;

import com.hotspot.domain.Administrator;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdministratorRepository extends JpaRepository<Administrator, Long> {

    Optional<Administrator> findByEmail(String email);

    /** Case-insensitive lookup for login (stored case comes from ADMIN_EMAIL env). */
    Optional<Administrator> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);
}
