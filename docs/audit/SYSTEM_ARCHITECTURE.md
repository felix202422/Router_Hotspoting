# System Architecture

Evidence-based description of the architecture **as implemented** (not as planned). File paths are
given for every claim. Planned-but-absent pieces are marked clearly.

---

## 1. High-level topology (target, from approved docs)

```
Customer device ──Wi-Fi──► MikroTik Hotspot gateway (Option B1, D-009/D-020) ◄──LAN──► ZTE G5TS 5G (uplink, untouched)
                                  │ RouterOS API (8728/8729)
                                  ▼
                     On-site server (Docker: Nginx + Spring Boot + PostgreSQL)
                                  │ HTTPS out
                    ┌─────────────┴──────────────┐
              M-Pesa Daraja                  Africa's Talking
```

Source: `docs/network/network-architecture-options.md` §4, `docs/architecture/system-architecture.md`.
**None of the deployment/hardware side exists in the repo yet** — no Dockerfile, no
docker-compose.yml, no nginx config, no CI (verified by glob for `Dockerfile*`, `docker-compose*`,
`nginx*`, `.github/**` → no matches).

## 2. Implemented runtime architecture (what actually runs today)

### 2.1 Frontend (only runnable tier)

```
React SPA (Vite build → dist/, preview on :4173, dev on :5173)
   │
   ├─ MOCK MODE (default): services/api.ts + services/mock/db.ts + mock/smsInbox.ts
   │     in-memory data, simulated latency, simulated M-Pesa (phones ending 0000 fail),
   │     simulated SMS shown in dev inbox widget — all browser-local.
   │
   └─ LIVE MODE (VITE_API_MODE=live): services/http.ts request()
         fetch('/api/v1' + path) + Bearer token from localStorage
         dev proxy: vite.config.ts proxies /api → http://localhost:8080
```

- Single API facade: `frontend/src/services/api.ts` (decision D-022). Every exported function
  branches `if (!MOCK) … else mock-implementation`.
- Auth storage: `localStorage` keys `hotspot_access_token`, `hotspot_refresh_token`,
  `hotspot_admin_profile` (`services/http.ts`, `features/auth/AuthContext.tsx`).
- Route guard: `features/auth/RequireAuth.tsx` redirects unauthenticated users to `/admin/login`.
  **Client-side only** — real enforcement must come from the backend (see §4).

### 2.2 Backend (source exists; does not compile; serves nothing)

Package layout under `backend/src/main/java/com/hotspot/`:

| Package | Contents | Role |
|---|---|---|
| `common` | `ApiProblem`, `GlobalExceptionHandler` (@RestControllerAdvice), `TraceIds` (X-Request-Id), `RateLimitService`, `AuditService` | cross-cutting error/audit/ratelimit |
| `domain` | 15 JPA entities + 14 enums (`Customer`, `Package`, `Payment`, `Subscription`, `AccessToken`, `RegisteredDevice`, `ActiveSession`, `DeviceReplacement`, `SmsNotification`, `WebhookEvent`, `AuditLog`, `Administrator`, `AdminRefreshToken`, `OperationalExpense`) | persistence model |
| `repository` | 15 Spring Data repositories (incl. `JpaSpecificationExecutor` on subscriptions; pessimistic-lock `@Query` for the expiry sweep) | data access |
| `security` | `JwtService` (HS256, 15-min access / 30-day refresh), `JwtAuthenticationFilter`, `SecurityConfig`, `ProblemDetailHandlers` | stateless JWT auth |
| `service` | `CustomerService`, `TokenService`, `SmsService`, `SubscriptionService`, `ExpiryService` (@Scheduled sweep), `BootstrapAdmin` (CommandLineRunner) | business logic |
| `integration.payment` | `PaymentProvider` SPI + `MockPaymentProvider` (works) + `DarajaAdapter` (honest stub) | payment abstraction |
| `integration.sms` | `SmsProvider` SPI + `MockSmsProvider` (works) + `AfricasTalkingAdapter` (honest stub) | SMS abstraction |
| `integration.hotspot` | `HotspotController` SPI + `MockHotspotController` (works) + `MikroTikAdapter` (honest stub) + `NullHotspotController` | enforcement abstraction |
| `web` (**absent**) | — | **no controllers exist** |

- Entry point: `HotspotApplication.java`. Config: `src/main/resources/application.yml` —
  everything env-driven (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`, `PAYMENT_PROVIDER`, `SMS_PROVIDER`, `HOTSPOT_CONTROLLER`,
  `CORS_ALLOWED_ORIGINS`, `DARAJA_*`, `AT_*`, `MIKROTIK_*`).
- Schema ownership: Flyway (`V1__init.sql`, `V2__admin_refresh_tokens.sql`),
  `spring.jpa.hibernate.ddl-auto: validate`.
- Adapter selection: `@ConditionalOnProperty` per provider (`app.payment.provider`,
  `app.sms.provider`, `app.hotspot.controller` — default `mock`).

## 3. Component communication (as designed vs as implemented)

| Communication | Design (docs) | Implemented? |
|---|---|---|
| Portal/admin UI → backend REST (`/api/v1/...`) | `docs/api/api-contract.md` (P1–P7, A1–A30) | ❌ Frontend has both branches; **backend has 0 controllers** → live mode returns 404/denyAll 403 |
| Backend → PostgreSQL | JPA + Flyway | ⚙️ Code present, **unverified at runtime** (DB never migrated in this environment; backend doesn't compile) |
| Backend → payment provider (Daraja webhook `/webhooks/payments/daraja`) | signature-verified, idempotent | ❌ No controller; `DarajaAdapter.verifySignature()` returns **false** (rejects everything) until Phase 5 |
| Backend → SMS provider | `SmsProvider.send()` | ⚙️ `MockSmsProvider` functional; AT stub logs error and returns failure |
| Backend → MikroTik | RouterOS API via `HotspotController` | ❌ `MikroTikAdapter` refuses grants with an error result (honest) |
| Backend → frontend polling | purchase status P3, subscription refresh | ❌ endpoints absent |
| Frontend mock → "server" | in-process functions | ✅ fully working |

## 4. Security architecture (as implemented)

- **AuthN/AuthZ:** stateless JWT. `SecurityConfig` declares an explicit allow-list
  (portal P1–P7 + `/admin/auth/{login,refresh,logout}` + Swagger), `ROLE_ADMIN` for
  `/api/v1/admin/**`, and `anyRequest().denyAll()` — a strict default-deny design.
  `JwtAuthenticationFilter` populates `ROLE_<role>` from the access-token claim.
- **CSRF:** disabled (documented rationale: Bearer-header auth, no cookies).
- **CORS:** allow-list from `CORS_ALLOWED_ORIGINS` (defaults `localhost:5173,4173`), scoped to `/api/**`.
- **Passwords:** BCrypt in `BootstrapAdmin`; first admin only, created from env when the table is empty.
- **Tokens:** portal access tokens stored as SHA-256 hashes (`TokenService`), raw value only in SMS;
  generic 401 messages (FR-C11); refresh tokens hashed in `admin_refresh_tokens` (V2).
- **Errors:** RFC 9457 problem+json (`GlobalExceptionHandler`), `server.error.include-message: never`.
- **Audit:** `AuditService` writes actor/action/entity/before-after JSON to `system_audit_logs`.
- **Rate limiting:** `RateLimitService` (in-memory sliding window) exists but is **never called** —
  there are no endpoints to protect yet (and no caller of `prune()`).

## 5. Background jobs

- `ExpiryService.scheduledSweep()` — `@Scheduled(fixedDelayString = "${app.scheduler.expiry-sweep-ms:60000}")`,
  guarded by `app.scheduler.expiry-sweep-enabled` (default true). Uses
  `SubscriptionRepository.findExpiredActiveForSweep` with `PESSIMISTIC_WRITE`.
  ⚠️ `application.yml` defines `expiry-sweep-cron` — a **dead key** the code never reads
  (code reads `expiry-sweep-ms`). See KNOWN_ISSUES.
- `MockPaymentProvider` schedules a simulated callback on a daemon `ScheduledExecutor`
  (`app.payment.mock-callback-seconds: 4`) publishing `MockPaymentResultEvent`.
  ⚠️ **No `@EventListener` for that event exists anywhere** — the simulated result is published
  into the void (see KNOWN_ISSUES-#2).

## 6. Data flow: purchase (designed)

1. `POST /purchases` (P2) → rate limit → find/create customer → create `payments` row
   (PENDING, `idempotency_key` = purchaseId) → `PaymentProvider.initiate()` (STK push).
2. Provider callback (P4) → signature check → `payment_webhook_events` replay guard →
   mark SUCCESS → `SubscriptionService.activateOrExtend()` **in one transaction**:
   extend per D-007 (append to `max(now, endsAt)`) or create → rotate token
   (hash stored) → `controller.grantAccess()` → SMS token + confirmation (redacted body persisted).
3. Customer polls P3 → sees SUCCESS → token arrives by SMS → `POST /auth/token-login` (P5) →
   session recorded in `active_sessions` (partial unique index enforces 1 live session).
4. `ExpiryService` sweep every minute: EXPIRED + revoke token/session/device/grant; payments kept.

**Status:** steps 2–4 exist only as service-layer code with no HTTP entry point; step 2's
callback listener is missing entirely.

## 7. Deployment architecture

**Not implemented.** Target (README + `system-architecture.md` §17): single on-site machine,
`docker compose up` (Nginx TLS reverse proxy → Spring Boot → PostgreSQL), nightly PG dumps,
Flyway on boot. Repo contains **no** Docker, nginx, compose, or CI files (`.gitignore` even has a
`docker-compose.override.yml` entry — anticipating them).
