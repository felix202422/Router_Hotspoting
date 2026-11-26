package com.hotspot.web;

import com.hotspot.common.ClientIp;
import com.hotspot.domain.WebhookStatus;
import com.hotspot.service.PaymentWebhookIngestionService;
import com.hotspot.service.PaymentWebhookIngestionService.Result;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * P4 — provider callback. The raw body is verified (signature + optional IP
 * allowlist) before any state change; the signature is the endpoint's auth.
 * Replays return 200 like a fresh callback (FR-M03: never make a provider retry
 * a duplicate it already delivered).
 */
@RestController
@RequestMapping("/api/v1/webhooks")
public class WebhookController {

    private static final Logger log = LoggerFactory.getLogger(WebhookController.class);

    private final PaymentWebhookIngestionService ingestion;

    public WebhookController(PaymentWebhookIngestionService ingestion) {
        this.ingestion = ingestion;
    }

    /** Contract requires 200 `{received:true}`; the additive status makes the
     *  replay verdict (IGNORED vs PROCESSED) observable without a provider retry. */
    public record WebhookResponse(boolean received, WebhookStatus status) {
    }

    @PostMapping(value = "/payments/daraja", consumes = MediaType.APPLICATION_JSON_VALUE)
    public WebhookResponse daraja(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Daraja-Signature", required = false) String darajaSignature,
            @RequestHeader(value = "X-Payment-Signature", required = false) String paymentSignature,
            @RequestHeader(value = "X-Signature", required = false) String genericSignature,
            HttpServletRequest http) {
        String signature = firstNonBlank(darajaSignature, paymentSignature, genericSignature);
        Result result = ingestion.ingest(rawBody, signature, ClientIp.of(http));
        if (result.status() == WebhookStatus.IGNORED) {
            log.info("Webhook acknowledged as duplicate/ignored");
        }
        return new WebhookResponse(true, result.status());
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
