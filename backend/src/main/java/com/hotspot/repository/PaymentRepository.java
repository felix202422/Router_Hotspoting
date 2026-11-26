package com.hotspot.repository;

import com.hotspot.domain.Payment;
import com.hotspot.domain.PaymentStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {

    Optional<Payment> findByIdempotencyKey(String idempotencyKey);

    Optional<Payment> findByProviderReference(String providerReference);

    @Query("select coalesce(sum(p.amountTzs), 0) from Payment p "
            + "where p.status = com.hotspot.domain.PaymentStatus.SUCCESS and p.paidAt >= :from")
    Long sumSuccessfulSince(@Param("from") Instant from);

    long countByStatus(PaymentStatus status);

    List<Payment> findByPaidAtIsNullAndStatus(PaymentStatus status);

    /** SUCCESS payments with paidAt inside [from, to] — used for TZ-day bucketing in Java. */
    List<Payment> findByPaidAtBetween(Instant from, Instant to);

    List<Payment> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    List<Payment> findByActivatedSubscriptionIdOrderByPaidAtDesc(Long subscriptionId);

    List<Payment> findByStatusAndPaidAtBefore(PaymentStatus status, Instant before);

    @Query("select count(p) from Payment p where p.customer.id = :customerId "
            + "and p.status = com.hotspot.domain.PaymentStatus.SUCCESS")
    long countSuccessfulByCustomer(@Param("customerId") Long customerId);

    @Query("select coalesce(sum(p.amountTzs), 0) from Payment p where p.customer.id = :customerId "
            + "and p.status = com.hotspot.domain.PaymentStatus.SUCCESS")
    Long sumSuccessfulByCustomer(@Param("customerId") Long customerId);
}
