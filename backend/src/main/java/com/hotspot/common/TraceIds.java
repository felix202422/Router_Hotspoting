package com.hotspot.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

/** Per-request correlation id for logs and problem+json responses (traceId). */
public final class TraceIds {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "traceId";

    private TraceIds() {
    }

    public static String current(HttpServletRequest request) {
        if (request == null) {
            return UUID.randomUUID().toString().substring(0, 16);
        }
        String header = request.getHeader(HEADER);
        if (header != null && !header.isBlank() && header.length() <= 64) {
            return header;
        }
        return UUID.randomUUID().toString().substring(0, 16);
    }
}
