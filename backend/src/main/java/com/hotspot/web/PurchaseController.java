package com.hotspot.web;

import com.hotspot.service.PurchaseService;
import com.hotspot.web.dto.PurchaseInitResponse;
import com.hotspot.web.dto.PurchaseRequest;
import com.hotspot.web.dto.PurchaseStatusResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public purchase endpoints P2/P3 (api-contract §2). */
@RestController
@RequestMapping("/api/v1")
public class PurchaseController {

    private final PurchaseService purchases;

    public PurchaseController(PurchaseService purchases) {
        this.purchases = purchases;
    }

    /** P2 — initiate a payment attempt (no access is granted here). */
    @PostMapping("/purchases")
    public ResponseEntity<PurchaseInitResponse> initiate(@Valid @RequestBody PurchaseRequest request) {
        return ResponseEntity.status(201).body(purchases.initiate(request));
    }

    /** P3 — poll by opaque reference; no phone/token/PII in the response. */
    @GetMapping("/purchases/{purchaseId}")
    public PurchaseStatusResponse status(@PathVariable String purchaseId) {
        return purchases.status(purchaseId);
    }
}
