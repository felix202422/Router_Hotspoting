package com.hotspot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * Sellable internet package (ER §packages).
 * Prices/durations live ONLY here — never hardcoded in the frontend (master rule 5).
 */
@Entity
@Table(name = "packages")
public class Package {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 500)
    private String description;

    /** Integer TZS — no floats anywhere (§12). */
    @Column(name = "price_tzs", nullable = false)
    private Long priceTzs;

    @Column(name = "duration_seconds", nullable = false)
    private Integer durationSeconds;

    /** NULL = unlimited (FR-P03). */
    @Column(name = "data_allowance_bytes")
    private Long dataAllowanceBytes;

    @Column(name = "max_download_kbps")
    private Integer maxDownloadKbps;

    @Column(name = "max_upload_kbps")
    private Integer maxUploadKbps;

    @Column(name = "device_limit", nullable = false)
    private Integer deviceLimit = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PackageStatus status = PackageStatus.ACTIVE;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "created_at", nullable = false)
    private java.time.Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private java.time.Instant updatedAt;

    @jakarta.persistence.PrePersist
    void onCreate() {
        createdAt = java.time.Instant.now();
        updatedAt = createdAt;
    }

    @jakarta.persistence.PreUpdate
    void onUpdate() {
        updatedAt = java.time.Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Long getPriceTzs() { return priceTzs; }
    public void setPriceTzs(Long priceTzs) { this.priceTzs = priceTzs; }
    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
    public Long getDataAllowanceBytes() { return dataAllowanceBytes; }
    public void setDataAllowanceBytes(Long dataAllowanceBytes) { this.dataAllowanceBytes = dataAllowanceBytes; }
    public Integer getMaxDownloadKbps() { return maxDownloadKbps; }
    public void setMaxDownloadKbps(Integer maxDownloadKbps) { this.maxDownloadKbps = maxDownloadKbps; }
    public Integer getMaxUploadKbps() { return maxUploadKbps; }
    public void setMaxUploadKbps(Integer maxUploadKbps) { this.maxUploadKbps = maxUploadKbps; }
    public Integer getDeviceLimit() { return deviceLimit; }
    public void setDeviceLimit(Integer deviceLimit) { this.deviceLimit = deviceLimit; }
    public PackageStatus getStatus() { return status; }
    public void setStatus(PackageStatus status) { this.status = status; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public java.time.Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(java.time.Instant createdAt) { this.createdAt = createdAt; }
    public java.time.Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.Instant updatedAt) { this.updatedAt = updatedAt; }
}
