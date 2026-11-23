# Hotspot Controller Integration Layer (Adapter Design)

**Phase:** 1 — System Planning and Design
**Status:** Design draft for approval
**Date:** 2026-11-23

---

## 1. Purpose

The master prompt requires: *"a modular network integration layer so that a different supported
hotspot controller can be integrated later without rewriting the business logic."*

All network enforcement flows through **one interface**. Business services (subscriptions,
payments, tokens) never import vendor SDKs or speak RouterOS/MikroTik directly.

## 2. The interface

```java
package com.hotspot.network;

/** Vendor-agnostic enforcement contract. Implementations: MikroTik, Mock, Null. */
public interface HotspotController {

    /** Liveness/config check used by the admin health panel and startup validation. */
    ControllerHealth health();

    /**
     * Grant internet access for an authorized subscription.
     * Idempotent: repeated calls for the same grantRef must not create duplicate sessions.
     *
     * @param request grantRef (subscription id), deviceHint (MAC, may be weak/randomized),
     *                speedProfile (package limits), validUntil (subscription expiry)
     */
    GrantResult grantAccess(GrantRequest request);

    /** Revoke access: remove/disable the hotspot user and terminate any live session. */
    RevokeResult revokeAccess(String grantRef);

    /** Force-disconnect the current session without revoking future access. */
    DisconnectResult disconnect(String grantRef);

    /** Current session for a grant, if any — powers admin "connected devices" view. */
    Optional<SessionView> findSession(String grantRef);

    /** All live sessions — powers dashboard "currently connected" and network page. */
    List<SessionView> listActiveSessions();

    /** True if enforcement is real; false for the Null (soft-gate) adapter. */
    boolean isEnforcementActive();
}
```

### Supporting types (sketch)

```java
record GrantRequest(String grantRef, String phoneE164, String deviceHint,
                    SpeedProfile speedProfile, Instant validUntil) {}

record SpeedProfile(Integer downKbps, Integer upKbps, Integer deviceLimit) {}

record SessionView(String grantRef, String ipAddress, String deviceIdentifier,
                   Instant connectedAt, long bytesIn, long bytesOut, SessionState state) {}

enum SessionState { CONNECTED, DISCONNECTED, EXPIRED, REVOKED }
```

## 3. Implementations

| Adapter | Class | When used |
|---|---|---|
| **MikroTik (primary)** | `MikroTikHotspotController` | Production, Option B1. Talks RouterOS API (secure API-over-TLS, port 8729) to the hotspot's **user database**: creates a token-named hotspot user with rate limits from the package, comment metadata = `grantRef`, removes it on revoke. Reads active sessions via `/ip/hotspot/user/active`. |
| **Mock (development/tests)** | `MockHotspotController` | UI development, integration tests, CI. In-memory sessions, deterministic behaviour, optional failure injection (timeouts, duplicate callbacks) for resilience tests. |
| **Null (soft gate)** | `NullHotspotController` | Option A mode. Grants "log" success without blocking anyone; `isEnforcementActive() == false` — the admin dashboard **must visibly badge "Enforcement: OFF (soft gate)"** so the limitation is never hidden. |

Selected by configuration:

```yaml
hotspot:
  controller: mikrotik   # mikrotik | mock | null
  mikrotik:
    host: ${HOTSPOT_API_HOST}
    port: 8729
    user: ${HOTSPOT_API_USER}
    password: ${HOTSPOT_API_PASSWORD}   # never in frontend, never in logs
    ssl: true
```

## 4. Lifecycle mapping

| Business event | Adapter call | Notes |
|---|---|---|
| Payment verified → subscription activated | `grantAccess(...)` | Rate limits = package profile; `validUntil` = computed expiry |
| Customer logs in with token (new device) | `disconnect(old)` then session proceeds | First login binds the session to the presenting device |
| Subscription expires (scheduler) | `revokeAccess(...)` | Also revokes token and removes device authorization (§11 of master prompt) |
| Admin disconnects a session | `disconnect(...)` | Session event recorded in `active_sessions` + audit log |
| Admin authorizes device replacement | `disconnect(...)` → re-bind on next login | Full record in `device_replacement_history` |
| Admin suspends subscription/customer | `revokeAccess(...)` | Reversible: `grantAccess(...)` on reactivate |

## 5. Design rules

1. **Idempotency** — every mutation keyed by `grantRef`; retries and duplicate webhooks can never
   create duplicate sessions or double-grant access.
2. **Fail-safe policy** — if the controller is unreachable:
   - *grant* fails → subscription stays ACTIVE but flagged `ENFORCEMENT_PENDING` (customer sees
     a "connecting, please wait" state; never claim access was granted when it wasn't);
   - *revoke* is retried by a scheduled reconciliation job (never silently dropped).
3. **Reconciliation job** — hourly: compare DB active subscriptions ↔ controller users;
   remove orphans, report drift to the admin health panel.
4. **No identity overreach** — MAC is a *hint* only (randomized MACs); the session's identity is
   the hotspot user (= the token). Anti-sharing = hotspot client isolation + per-user rate limit +
   one-session-per-grant, with honest documentation that tethering cannot be 100% prevented.
5. **Auditability** — every adapter call logs `grantRef`, action, result, latency — **never** the
   token itself or controller passwords.
6. **Events** — connect/disconnect events emitted to the application are persisted
   (`active_sessions`, `system_audit_logs`) regardless of adapter.

## 6. Future controllers

A new controller (e.g., a different MikroTik, OpenWrt-based AP, or commercial hotspot
appliance) = one new `HotspotController` implementation + configuration. Business logic,
portal, dashboard and analytics are untouched. The admin Network page degrades gracefully
when `isEnforcementActive() == false` or the controller is offline — **no fabricated network
data is ever displayed** (master prompt §10).
