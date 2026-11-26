package com.hotspot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Paid Wi-Fi Hotspot Management System — backend entry point (Phase 4).
 * Modular monolith: api → service → (repository | integration), see
 * docs/architecture/system-architecture.md §3.
 */
@SpringBootApplication
@EnableScheduling
public class HotspotApplication {

    public static void main(String[] args) {
        SpringApplication.run(HotspotApplication.class, args);
    }
}
