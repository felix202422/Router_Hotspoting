# Improvement Roadmap

Phased plan derived from audit findings. Guiding principles: **no rewrites** — the documented
architecture (D-001…D-026), the schema, the frontend, and the service-layer code are sound;
everything below completes and hardens what exists. Each phase ends with a push to the repo and
a gate (per session scope D-008: pause for approval before code).

---

## Phase 1 — Critical fixes & stabilization (days)

| # | Task | Closes | Effort |
|---|---|---|---|
| 1.1 | Fix the 5 backend compile errors (imports + `Date.from(Instant)`) and get `mvn -q test` green | KI-1, SEC-1 | XS |
| 1.2 | Add `@EventListener` for `MockPaymentResultEvent` → idempotent activation core | KI-2 | S |
| 1.3 | Remove/replace dead `expiry-sweep-cron` key; schedule `RateLimitService.prune()` | KI-7, KI-4 | XS |
| 1.4 | Store NULL (not `10.10.0.2`) for session IP until real controller data | KI-6 | XS |
| 1.5 | Resolve A22 resend-token contradiction (product decision → D-027) | KI-5 | S + decision |
| 1.6 | Commit current uncommitted work (restyle + Phase 4 foundation) as its own phase push | hygiene | S |

**Gate:** backend compiles; mock purchase flow activates end-to-end in a local test.

## Phase 2 — Completing existing functionality (the API layer)

| # | Task | Notes |
|---|---|---|
| 2.1 | Web layer skeleton: DTOs, request validation, OpenAPI annotations, `Paged<T>` envelope | springdoc already on classpath |
| 2.2 | **A1–A4 admin auth** (login, refresh w/ family rotation, logout, me) + `AdminAuthService` using V2 table | closes KI-3/KI-10 server side |
| 2.3 | **P1, P5, P6, P7** portal endpoints (packages, token-login, subscription, replacement) | service logic already exists |
| 2.4 | **P2, P3, P4** purchase + webhook core: idempotency, D-007 activation, replay guard via `payment_webhook_events` | money path — write tests first |
| 2.5 | **A5–A30** admin endpoints (stats, customers, packages, subscriptions, payments, analytics, network, audit) | contract is the spec |
| 2.6 | Wire `RateLimitService` into P2/P5/A1 per contract §4 | closes KI-4 |
| 2.7 | Frontend: 401→refresh retry in `http.ts`, server logout, `AuthContext` refresh | closes KI-3 client side |
| 2.8 | Live-mode E2E smoke suite (MockMvc + one Playwright path) | starts Phase 6 early |

**Gate:** `VITE_API_MODE=live` works against local Postgres for purchase → token → connect.

## Phase 3 — Advanced Wi-Fi & hotspot capabilities

| # | Task | Notes |
|---|---|---|
| 3.1 | MikroTik adapter behind untouched ZTE (Option B1, D-009/D-020) — RouterOS API session, grant/revoke/disconnect/list | replace honest stub |
| 3.2 | Real session IP/bytes sync → fix KI-6 properly; network page becomes genuinely live | FR-D06 |
| 3.3 | Multi-router readiness (controller registry, per-site health) | optional, only if needed |
| 3.4 | Bandwidth/data/device-limit enforcement from package profile through grant | uses existing `GrantRequest` fields |
| 3.5 | Option A soft-gate vs enforcement toggle surfaced on dashboard | `NullHotspotController` exists |

**Gate:** hardware-in-the-loop test on site; enforcement ON with real traffic.

## Phase 4 — Financial & payment improvements

| # | Task | Notes |
|---|---|---|
| 4.1 | M-Pesa Daraja sandbox STK push + HMAC webhook + signature/replay verification | replace `DarajaAdapter` stub; needs owner credentials (D-003) |
| 4.2 | Payment reconciliation report (provider ref vs `payments` rows) + idempotency audit | |
| 4.3 | Refund/void flow (status `REFUNDED` exists; no UI/API yet) | decide policy |
| 4.4 | Revenue analytics verification vs TZ-day buckets; profit stub (`operational_expenses`) stays out of MVP | FR-R05 |
| 4.5 | Africa's Talking SMS (or chosen provider) replacing `MockSmsProvider` | D-004 sandbox-first |

**Gate:** one real sandbox payment completes → token delivered by real SMS.

## Phase 5 — Monitoring, analytics & automation

| # | Task | Notes |
|---|---|---|
| 5.1 | Health/metrics endpoint (Spring Actuator) + uptime logging | |
| 5.2 | Alerting: webhook failures, controller offline, payment drift (there's a drift log already) | |
| 5.3 | Scheduled reports (daily revenue SMS/email) | after 4.x |
| 5.4 | Audit-log retention/archival (KI: unbounded growth) | |
| 5.5 | Bundle code-splitting; analytics query tuning vs NFR-10 | KI-15 |

## Phase 6 — Security, scalability & production readiness

| # | Task | Notes |
|---|---|---|
| 6.1 | Test suite to meaningful coverage: services (idempotency, extension, sweep), controllers (MockMvc), facade (vitest), one E2E | KI-8 |
| 6.2 | Lint/format (ESLint+Prettier, Checkstyle) + CI workflow running build+tests on push | |
| 6.3 | Additive migrations: status CHECKs (KI-11), missing FK indexes (KI-12), refresh-token cleanup job | never edit V1/V2 |
| 6.4 | Admin password change/rotation + lockout policy (SEC-5) | |
| 6.5 | Rate-limit persistence decision (single-node OK → document; Redis only if scaled) | SEC-7 |
| 6.6 | Docker Compose + Nginx TLS + nightly PG backup + runbooks (Phase 7 in original plan) | KI-13 |
| 6.7 | Secrets audit per release; gate demo creds behind `DEV` (SEC-4) | |
| 6.8 | Load sanity: p95 < 500 ms portal, < 2 s analytics over 12 months of seeded data (NFR-05/NFR-10) | |

**Gate:** production-readiness review against NFR-01…NFR-10 with evidence.

---

## Suggested sequencing & why

```
Phase 1 (fix compile + mock flow)  →  Phase 2 (API layer, the long pole)
        →  Phase 3/4 in parallel (MikroTik needs hardware; Daraja needs credentials — both start with sandbox)
        →  Phase 5  →  Phase 6 (tests/CI start EARLY inside Phase 2, not deferred)
```

**Explicitly NOT recommended:** rewriting the frontend, replacing Spring Boot, changing the
schema, or abandoning the mock/live facade (D-022). Evidence does not support any of those.
