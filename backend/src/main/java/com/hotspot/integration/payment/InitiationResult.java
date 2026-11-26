package com.hotspot.integration.payment;

/**
 * @param providerReference  provider-side reference (stored in payments.provider_reference)
 * @param instructions       customer-facing hint shown while polling (P2)
 * @param accepted           false = provider refused the attempt up-front
 * @param declineReason      set when accepted == false
 */
public record InitiationResult(
        String providerReference,
        String instructions,
        boolean accepted,
        String declineReason) {
}
