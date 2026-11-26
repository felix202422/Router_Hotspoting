package com.hotspot.security;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless JWT security (system-architecture §5):
 * - public portal endpoints = exactly the Phase 2 contract, nothing more
 * - /api/v1/admin/** requires ROLE_ADMIN (auth/login + refresh are public by contract)
 * - CSRF disabled (Bearer header auth; no cookies) — documented, not accidental
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final ProblemDetailHandlers problemDetailHandlers;
    private final String allowedOrigins;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter,
                          ProblemDetailHandlers problemDetailHandlers,
                          @Value("${app.security.cors-allowed-origins}") String allowedOrigins) {
        this.jwtFilter = jwtFilter;
        this.problemDetailHandlers = problemDetailHandlers;
        this.allowedOrigins = allowedOrigins;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(problemDetailHandlers)
                        .accessDeniedHandler(problemDetailHandlers))
                .authorizeHttpRequests(auth -> auth
                        // --- public customer portal (contract §2) ---
                        .requestMatchers(HttpMethod.GET, "/api/v1/packages").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/purchases").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/purchases/*").permitAll()
                        .requestMatchers("/api/v1/webhooks/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/token-login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/subscriptions/current").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/device-replacement-requests").permitAll()
                        // --- admin auth (contract A1/A2/A3) ---
                        .requestMatchers("/api/v1/admin/auth/login").permitAll()
                        .requestMatchers("/api/v1/admin/auth/refresh").permitAll()
                        .requestMatchers("/api/v1/admin/auth/logout").permitAll()
                        // --- everything else under /admin needs JWT + ROLE_ADMIN ---
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        // --- API docs (dev/staging aid) ---
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        // --- strict default: contract endpoints only (§5) ---
                        .anyRequest().denyAll())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Access-Token", "X-Request-Id"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
