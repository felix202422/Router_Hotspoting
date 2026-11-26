package com.hotspot.web;

import com.hotspot.common.ClientIp;
import com.hotspot.common.Paging;
import com.hotspot.domain.CustomerStatus;
import com.hotspot.service.admin.AdminCustomerService;
import com.hotspot.web.dto.admin.CustomerDetailDto;
import com.hotspot.web.dto.admin.CustomerDto;
import com.hotspot.web.dto.admin.PagedDto;
import com.hotspot.web.dto.admin.RegisteredDeviceDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** A6–A9 + A12: customer list/detail, status, device and force-disconnect. */
@RestController
@RequestMapping("/api/v1/admin/customers")
public class AdminCustomerController {

    private final AdminCustomerService customers;

    public AdminCustomerController(AdminCustomerService customers) {
        this.customers = customers;
    }

    @GetMapping
    public PagedDto<CustomerDto> list(@RequestParam(required = false) String search,
                                      @RequestParam(required = false) CustomerStatus status,
                                      @RequestParam(defaultValue = "1") int page,
                                      @RequestParam(defaultValue = "25") int size) {
        return customers.list(search, status, Paging.page(page), Paging.size(size));
    }

    @GetMapping("/{id}")
    public CustomerDetailDto detail(@PathVariable Long id) {
        return customers.detail(id);
    }

    @PostMapping("/{id}/suspend")
    public ResponseEntity<Void> suspend(@PathVariable Long id, HttpServletRequest request) {
        customers.setStatus(id, CustomerStatus.SUSPENDED, ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reactivate")
    public ResponseEntity<Void> reactivate(@PathVariable Long id, HttpServletRequest request) {
        customers.setStatus(id, CustomerStatus.ACTIVE, ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/device")
    public RegisteredDeviceDto device(@PathVariable Long id) {
        return customers.device(id);
    }

    @PostMapping("/{id}/disconnect")
    public ResponseEntity<Void> disconnect(@PathVariable Long id, HttpServletRequest request) {
        customers.disconnectCustomer(id, ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }
}
