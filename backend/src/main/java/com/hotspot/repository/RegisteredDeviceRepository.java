package com.hotspot.repository;

import com.hotspot.domain.DeviceStatus;
import com.hotspot.domain.RegisteredDevice;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RegisteredDeviceRepository extends JpaRepository<RegisteredDevice, Long> {

    List<RegisteredDevice> findBySubscriptionIdAndStatus(Long subscriptionId, DeviceStatus status);

    /** Unbinds the device when a subscription is suspended/revoked/replaced (FR-S03). */
    @Modifying(clearAutomatically = true)
    @Query("update RegisteredDevice d set d.status = :newStatus, d.unboundAt = :now "
            + "where d.subscription.id = :subscriptionId and d.status = :activeStatus")
    int unbindDevices(@Param("subscriptionId") Long subscriptionId,
                      @Param("newStatus") DeviceStatus newStatus,
                      @Param("activeStatus") DeviceStatus activeStatus,
                      @Param("now") Instant now);
}
