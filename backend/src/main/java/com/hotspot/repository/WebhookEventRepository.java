package com.hotspot.repository;

import com.hotspot.domain.WebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookEventRepository extends JpaRepository<WebhookEvent, Long> {

    /** Replay protection (FR-M03): UNIQUE(provider, provider_event_id) also backs this. */
    boolean existsByProviderAndProviderEventId(String provider, String providerEventId);
}
