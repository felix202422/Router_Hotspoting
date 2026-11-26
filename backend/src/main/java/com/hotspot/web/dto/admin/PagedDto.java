package com.hotspot.web.dto.admin;

import java.util.List;
import org.springframework.data.domain.Page;

/** Frontend `Paged<T>`: 1-based page, default size 25 (api-contract §3). */
public record PagedDto<T>(List<T> items, int page, int size, long total) {

    public static <T> PagedDto<T> of(Page<T> result) {
        return new PagedDto<>(result.getContent(), result.getNumber() + 1, result.getSize(), result.getTotalElements());
    }
}
