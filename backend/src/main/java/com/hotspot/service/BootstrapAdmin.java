package com.hotspot.service;

import com.hotspot.domain.AdminRole;
import com.hotspot.domain.AdminStatus;
import com.hotspot.domain.Administrator;
import com.hotspot.repository.AdministratorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * First-run admin bootstrap: when the administrators table is empty AND
 * ADMIN_EMAIL + ADMIN_PASSWORD are provided via environment variables, one
 * ADMIN account is created (bcrypt-hashed, NFR-03). No credentials are ever
 * committed (master rule 6). If the table already has an admin, this is a
 * no-op — passwords are never changed on restart.
 */
@Component
public class BootstrapAdmin implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdmin.class);

    private final AdministratorRepository administrators;

    public BootstrapAdmin(AdministratorRepository administrators) {
        this.administrators = administrators;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (administrators.count() > 0) {
            return;
        }
        String email = env("ADMIN_EMAIL");
        String password = env("ADMIN_PASSWORD");
        if (email == null || password == null) {
            log.warn("No administrators exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set — "
                    + "admin login will be unavailable until they are provided.");
            return;
        }
        if (password.length() < 8) {
            log.error("ADMIN_PASSWORD must be at least 8 characters — bootstrap skipped.");
            return;
        }
        Administrator admin = new Administrator();
        admin.setEmail(email.trim().toLowerCase());
        admin.setPasswordHash(new BCryptPasswordEncoder().encode(password));
        admin.setFullName("Administrator");
        admin.setRole(AdminRole.ADMIN);
        admin.setStatus(AdminStatus.ACTIVE);
        administrators.save(admin);
        log.info("Bootstrapped administrator account {}", admin.getEmail());
    }

    private static String env(String name) {
        String value = System.getenv(name);
        return (value == null || value.isBlank()) ? null : value;
    }
}
