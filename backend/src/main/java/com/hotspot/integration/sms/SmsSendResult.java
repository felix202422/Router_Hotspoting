package com.hotspot.integration.sms;

/**
 * @param success           provider accepted the message
 * @param providerMessageId provider-side id (may be null for mock)
 * @param error             failure detail (redacted — never the message body)
 */
public record SmsSendResult(boolean success, String providerMessageId, String error) {
}
