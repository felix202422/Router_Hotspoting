package com.hotspot.web.dto;

import com.hotspot.domain.Administrator;

/** Admin profile as returned by A1/A2/A4 — matches frontend `AdminProfile`. */
public record ProfileDto(Long id, String email, String fullName, String role) {

    public static ProfileDto from(Administrator admin) {
        return new ProfileDto(admin.getId(), admin.getEmail(), admin.getFullName(), admin.getRole().name());
    }
}
