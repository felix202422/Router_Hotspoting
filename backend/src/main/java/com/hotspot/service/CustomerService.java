package com.hotspot.service;

import com.hotspot.common.ApiProblem;
import com.hotspot.domain.Customer;
import com.hotspot.domain.CustomerStatus;
import com.hotspot.repository.CustomerRepository;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Customer lookup/creation keyed by E.164 phone (FR-C01). */
@Service
public class CustomerService {

    private final CustomerRepository customers;

    public CustomerService(CustomerRepository customers) {
        this.customers = customers;
    }

    /** Find or create within the caller's transaction (payment flow uses this). */
    @Transactional
    public Customer findOrCreate(String phoneE164) {
        Optional<Customer> existing = customers.findByPhoneE164(phoneE164);
        if (existing.isPresent()) {
            Customer customer = existing.get();
            customer.setLastSeenAt(Instant.now());
            return customers.save(customer);
        }
        Customer customer = new Customer();
        customer.setPhoneE164(phoneE164);
        customer.setStatus(CustomerStatus.ACTIVE);
        customer.setFirstSeenAt(Instant.now());
        customer.setLastSeenAt(customer.getFirstSeenAt());
        return customers.save(customer);
    }

    @Transactional
    public void touchLastSeen(Customer customer) {
        customer.setLastSeenAt(Instant.now());
        customers.save(customer);
    }

    public Customer requireActive(String phoneE164) {
        Customer customer = customers.findByPhoneE164(phoneE164)
                .orElseThrow(() -> ApiProblem.notFound("Customer not found."));
        if (customer.getStatus() == CustomerStatus.SUSPENDED) {
            throw ApiProblem.forbidden("This account is suspended. Please contact support.");
        }
        return customer;
    }
}
