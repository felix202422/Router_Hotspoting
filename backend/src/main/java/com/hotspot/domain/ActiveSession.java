package com.hotspot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.ColumnTransformer;

/** Live/historical controller session (ER §active_sessions). */
@Entity
@Table(name = "active_sessions")
public class ActiveSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subscription_id", nullable = false)
    private Subscription subscription;

    /** MikroTik active-session id (unique). */
    @Column(name = "controller_session_id", nullable = false, unique = true, length = 64)
    private String controllerSessionId;

    /** Postgres INET column — Java side keeps the canonical string form.
     *  NULL until the controller reports the real client IP (FR-D06).
     *  Explicit cast: Hibernate binds String as varchar, INET rejects it. */
    @Column(name = "ip_address", columnDefinition = "inet")
    @ColumnTransformer(write = "cast(? as inet)")
    private String ipAddress;

    @Column(name = "mac_hint", length = 17)
    private String macHint;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    /** NULL = currently live. */
    @Column(name = "ended_at")
    private Instant endedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "end_reason", length = 30)
    private EndReason endReason;

    @Column(name = "bytes_in", nullable = false)
    private Long bytesIn = 0L;

    @Column(name = "bytes_out", nullable = false)
    private Long bytesOut = 0L;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Subscription getSubscription() { return subscription; }
    public void setSubscription(Subscription subscription) { this.subscription = subscription; }
    public String getControllerSessionId() { return controllerSessionId; }
    public void setControllerSessionId(String controllerSessionId) { this.controllerSessionId = controllerSessionId; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getMacHint() { return macHint; }
    public void setMacHint(String macHint) { this.macHint = macHint; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
    public EndReason getEndReason() { return endReason; }
    public void setEndReason(EndReason endReason) { this.endReason = endReason; }
    public Long getBytesIn() { return bytesIn; }
    public void setBytesIn(Long bytesIn) { this.bytesIn = bytesIn; }
    public Long getBytesOut() { return bytesOut; }
    public void setBytesOut(Long bytesOut) { this.bytesOut = bytesOut; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
