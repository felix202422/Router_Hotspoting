package com.hotspot.integration.sms;

/**
 * SMS provider SPI (system-architecture §3) — selected by app.sms.provider:
 * mock (dev) | africastalking (Phase 5, D-004). The raw token exists only in
 * this payload at send time (FR-T02/T04); persistence always stores the
 * redacted body.
 */
public interface SmsProvider {

    String name();

    SmsSendResult send(String phoneE164, String fullBody);
}
