package com.hotspot.integration.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * DEV-ONLY SMS provider (sms.provider=mock): marks messages delivered and logs
 * metadata only — the body (which contains the token) is never written to logs
 * (D-012). Real Africa's Talking integration arrives in Phase 5 (D-004).
 */
@Component
@ConditionalOnProperty(name = "app.sms.provider", havingValue = "mock", matchIfMissing = true)
public class MockSmsProvider implements SmsProvider {

    private static final Logger log = LoggerFactory.getLogger(MockSmsProvider.class);

    @Override
    public String name() {
        return "MOCK";
    }

    @Override
    public SmsSendResult send(String phoneE164, String fullBody) {
        // Intentionally does NOT log fullBody — tokens must never reach logs (D-012).
        log.info("MOCK SMS accepted to {} ({} chars)", phoneE164, fullBody == null ? 0 : fullBody.length());
        return new SmsSendResult(true, "MOCK-" + System.currentTimeMillis(), null);
    }
}
