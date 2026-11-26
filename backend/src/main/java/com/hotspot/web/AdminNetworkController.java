package com.hotspot.web;

import com.hotspot.common.ClientIp;
import com.hotspot.service.admin.AdminNetworkService;
import com.hotspot.web.dto.admin.NetworkHealthDto;
import com.hotspot.web.dto.admin.NetworkSessionDto;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** A27–A29 — honest controller-backed network state (FR-D06). */
@RestController
@RequestMapping("/api/v1/admin/network")
public class AdminNetworkController {

    private final AdminNetworkService network;

    public AdminNetworkController(AdminNetworkService network) {
        this.network = network;
    }

    @GetMapping("/health")
    public NetworkHealthDto health() {
        return network.health();
    }

    @GetMapping("/sessions")
    public List<NetworkSessionDto> sessions() {
        return network.listSessions();
    }

    @PostMapping("/sessions/{grantRef}/disconnect")
    public ResponseEntity<Void> disconnect(@PathVariable String grantRef, HttpServletRequest request) {
        network.disconnect(grantRef, ClientIp.of(request));
        return ResponseEntity.noContent().build();
    }
}
