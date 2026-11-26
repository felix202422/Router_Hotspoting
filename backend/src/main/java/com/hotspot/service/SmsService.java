package com.hotspot.service;

import com.hotspot.domain.Customer;
import com.hotspot.domain.SmsNotification;
import com.hotspot.domain.SmsStatus;
import com.hotspot.domain.SmsType;
import com.hotspot.domain.Subscription;
import com.hotspot.integration.sms.SmsProvider;
import com.hotspot.integration.sms.SmsSendResult;
import com.hotspot.repository.SmsNotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SMS persistence + dispatch (FR-T02/T04, D-012):
 * the DB stores the REDACTED body only ("****7Q2F"); the raw token passes
 * through the provider payload and is never logged.
 */
@Service
public class SmsService {

    private static final Logger log = LoggerFactory.getLogger(SmsService.class);

    private final SmsNotificationRepository smsRepository;
    private final SmsProvider provider;

    public SmsService(SmsNotificationRepository smsRepository, SmsProvider provider) {
        this.smsRepository = smsRepository;
        this.provider = provider;
    }

    public static String redact(String body, String secret) {
        if (secret == null || secret.isEmpty()) {
            return body;
        }
        return body.replace(secret, "****" + secret.substring(secret.length() - 4));
    }

    /** Queues + sends a token SMS. Returns the persisted (redacted) row. */
    @Transactional
    public SmsNotification sendToken(Customer customer, Subscription subscription, String rawToken, String packageName) {
        String fullBody = "Your " + packageName + " Wi-Fi access token: " + rawToken
                + ". Keep it safe — use it to connect.";
        return dispatch(customer, subscription, SmsType.TOKEN, fullBody, rawToken);
    }

    /** Confirmation SMS after verified payment — never contains the token. */
    @Transactional
    public SmsNotification sendPaymentConfirmation(Customer customer, Subscription subscription,
                                                   long amountTzs, String packageName, String endsAtText) {
        String fullBody = "M-Pesa payment of TZS " + amountTzs + " received. " + packageName
                + " active until " + endsAtText + ".";
        return dispatch(customer, subscription, SmsType.CONFIRMATION, fullBody, null);
    }

    private SmsNotification dispatch(Customer customer, Subscription subscription,
                                     SmsType type, String fullBody, String rawToken) {
        SmsNotification row = new SmsNotification();
        row.setCustomer(customer);
        row.setSubscription(subscription);
        row.setType(type);
        row.setPhoneE164(customer.getPhoneE164());
        row.setBodyRedacted(rawToken != null ? redact(fullBody, rawToken) : fullBody);
        row.setProvider(provider.name());
        row.setStatus(SmsStatus.QUEUED);

        SmsSendResult result = provider.send(customer.getPhoneE164(), fullBody);
        row.setAttempts(1);
        if (result.success()) {
            row.setStatus(SmsStatus.DELIVERED);
            row.setProviderMessageId(result.providerMessageId());
        } else {
            row.setStatus(SmsStatus.FAILED);
            row.setLastError(result.error());
            log.warn("SMS dispatch failed type={} phone={} err={}", type, customer.getPhoneE164(), result.error());
        }
        return smsRepository.save(row);
    }
}
