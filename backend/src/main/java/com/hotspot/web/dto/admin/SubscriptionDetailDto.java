package com.hotspot.web.dto.admin;

import java.time.Instant;
import java.util.List;

/** A18: admin subscription view + financial/session history (no token secret). */
public record SubscriptionDetailDto(SubscriptionAdminDto subscription,
                                    List<PaymentDto> payments, List<Instant> sessionHistory) {
}
