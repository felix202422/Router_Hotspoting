package com.hotspot.integration.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Africa's Talking placeholder (decision D-004: sandbox-first, credentials
 * pending). Wired only when sms.provider=africastalking — fails honestly until
 * Phase 5; never pretends a message was delivered.
 */
@Component
@ConditionalOnProperty(name = "app.sms.provider", havingValue = "africastalking")
public class AfricasTalkingAdapter implements SmsProvider {

    private static final Logger log = LoggerFactory.getLogger(AfricasTalkingAdapter.class);

    @Override
    public String name() {
        return "AFRICASTALKING";
    }

    @Override
    public SmsSendResult send(String phoneE164, String fullBody) {
        log.error("Africa's Talking called before Phase 5 integration — SMS not sent to {}", phoneE164);
        return new SmsSendResult(false, null,
                "SMS provider not configured yet (Phase 5) — message queued for retry");
    }
}
