package com.hotspot.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** P2 response — mirrors frontend `PurchaseInitResponse` exactly. */
public record PurchaseInitResponse(
        String purchaseId,
        String status,
        @JsonProperty("package") PackageBrief packageInfo,
        String phone,
        String paymentInstructions) {

    /** Named `package` in JSON via @JsonProperty on the record component below. */
    public record PackageBrief(String name, long priceTzs, int durationSeconds) {
    }
}
