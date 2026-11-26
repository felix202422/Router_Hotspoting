package com.hotspot.web.dto;

import java.time.Instant;

/** P5 response — mirrors frontend `TokenLoginResponse` exactly. */
public record TokenLoginResponse(
        SubscriptionSummaryDto subscription,
        Session session) {

    public record Session(String state, Instant boundAt) {
    }
}
