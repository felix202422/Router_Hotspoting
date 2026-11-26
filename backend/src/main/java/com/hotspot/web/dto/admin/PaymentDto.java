package com.hotspot.web.dto.admin;

import com.hotspot.domain.Payment;
import java.time.Instant;

/** Frontend `Payment`: purchaseId is the opaque idempotency_key, never the DB id. */
public record PaymentDto(Long id, String purchaseId, Long customerId, String phoneE164,
                         Long packageId, String packageName, Long amountTzs, String provider,
                         String providerReference, String status, String failureReason,
                         Instant paidAt, Instant createdAt, Long activatedSubscriptionId) {

    public static PaymentDto from(Payment payment) {
        return new PaymentDto(payment.getId(), payment.getIdempotencyKey(), payment.getCustomer().getId(),
                payment.getPhoneE164(), payment.getPkg().getId(), payment.getPkg().getName(),
                payment.getAmountTzs(), payment.getProvider(), payment.getProviderReference(),
                payment.getStatus().name(), payment.getFailureReason(), payment.getPaidAt(),
                payment.getCreatedAt(), payment.getActivatedSubscription() == null
                        ? null : payment.getActivatedSubscription().getId());
    }
}
