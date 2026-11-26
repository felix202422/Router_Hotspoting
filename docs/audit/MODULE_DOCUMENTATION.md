# Module Documentation

Detailed, evidence-based description of every module in the repository. Each entry states what the
code **actually does**, not what the plan says it should do.

---

## A. Documentation module (`docs/`) — Phase 1–2 ✅ COMPLETE

| File | Contents |
|---|---|
| `architecture/requirements.md` | FR-C/P/A/S/M/T/D/R (customer, packages, access, sessions, money, SMS, dashboard, reporting) + NFR-01…NFR-10, traced to the master prompt |
| `architecture/use-cases.md` | UC narratives + invariants (UC01–UC12 incl. device replacement UC09) |
| `architecture/system-architecture.md` | Components, security architecture, §4.1 activation transaction, §4.2 expiry sweep, §17 deployment |
| `architecture/ui-wireframes.md` | §14 design language, wireframes for all portal/admin screens, §13 responsive behaviour |
| `architecture/decision-log.md` | D-001…D-026 (D-025 additive V2 migration, D-026 green design refresh) |
| `architecture/implementation-plan.md`, `mvp-scope.md` | Phase 3–7 plan, MVP cut line |
| `database/er-diagram.md` | Full ER (source for `V1__init.sql`) |
| `api/api-contract.md` | P1–P7 portal, A1–A30 admin, error model, rate limits, webhook rules — **binding for Phase 4** |
| `network/*` | ZTE G5TS feasibility (T1–T9 checklist), architecture options A/B1/B2/C (B1 recommended, D-020), `HotspotController` adapter design |

---

## B. Frontend (`frontend/`) — Phase 3 ✅ (mock mode) / ⚠️ live mode pending backend

### B1 Build & config
- `vite.config.ts` — React plugin, `@` alias, dev port 5173, `/api → localhost:8080` proxy, sourcemaps.
- `tailwind.config.js` — green design kit (D-026): `mint-*` page bg, `forest-*` panels, `leaf-*`
  accents, `citrus-*` CTAs; `shadow-card`/`shadow-drawer`; fade/slide animations.
- `tsconfig.json` — strict; `index.css` — base layer, 44px `.tap` targets, `overflow-x: hidden` (NFR-01).
- **No ESLint/Prettier config exists** (only `tsc` + Vite in `npm run build`).

### B2 Routing (`src/App.tsx`)
| Route | Page | Guard |
|---|---|---|
| `/` | `LandingPage` (hero, how-it-works, package list from API) | public |
| `/buy` | `PurchasePage` (3-step Stepper: package → phone → STK poll) | public |
| `/connect` | `TokenLoginPage` (token + device fingerprint, generic errors) | public |
| `/subscription` | `SubscriptionPage` (status, countdown, device info) | public |
| `/device-replacement` | `DeviceReplacementPage` (request form → PENDING) | public |
| `/admin/login` | `AdminLoginPage` (inline errors, demo hint) | public |
| `/admin` | `OverviewPage` (KPI StatCards, 30-day revenue area chart) | `RequireAuth` |
| `/admin/customers` | `CustomersPage` (search, detail drawer, suspend/reactivate, disconnect) | `RequireAuth` |
| `/admin/packages` | `PackagesPage` (CRUD, activate/deactivate, duration unit converter) | `RequireAuth` |
| `/admin/subscriptions` | `SubscriptionsPage` (filters, suspend/resume/revoke) | `RequireAuth` |
| `/admin/payments` | `PaymentsPage` (filters, resend-token action) | `RequireAuth` |
| `/admin/network` | `NetworkPage` (health, live sessions, disconnect; never fabricates data) | `RequireAuth` |
| `/admin/analytics` | `AnalyticsPage` (TZ-day buckets, package/customer charts, CSV export) | `RequireAuth` |
| `/admin/audit` | `AuditLogPage` (read-only trail) | `RequireAuth` |
| `*` | `NotFoundPage` | public |

### B3 Shared components (`src/components/`, 16)
`Button` (primary = citrus CTA), `Card`, `Badge`/status tones, `StatCard`, `Input`/`Field`/`Textarea`/
`Select`, `Modal`, `Drawer`, `ConfirmDialog`, `DataTable` (table ≥1024px, stacked cards below —
NFR-01, fixed in this session), `Pagination`, `Stepper`, `Toast` (ToastProvider), `Spinner`,
`EmptyState`, `PageHeader`.

### B4 Services
- `services/api.ts` (~1,030 lines) — **the single facade** (D-022). 38 exported functions. Mock
  branch implements: idempotent purchase (P2/P3), D-007 extension, token rotation, generic token
  errors, rate limits (5/min token login, purchase per phone), TZ-day analytics
  (`Africa/Dar_es_Salaam`), device binding, replacement queue, audit trail. Live branch calls
  `http.request('/…')` for **35 distinct paths** matching the contract.
- `services/http.ts` — fetch wrapper, Bearer header, RFC 9457 → `ApiError`, 204 handling.
  **No token-refresh logic**: nothing ever calls `/admin/auth/refresh` (A2), and `adminLogout()`
  only clears localStorage — it never calls A3. → live sessions die with the 15-min access token.
- `services/mock/db.ts` — seeded deterministic dataset (Mulberry32, seed 20261123): 6 packages
  mirroring `V1__init.sql` seeds, ~40 customers, payments, subscriptions, tokens, sessions,
  replacements, audits. Helpers: `extendSubscription` (D-007), `rotateToken`, `invalidateSessionsFor`.
- `services/mock/smsInbox.ts` + `MockSmsInbox` widget — dev-only SMS view; raw token exists **only**
  here (FR-A02).

### B5 Auth (`features/auth/`)
`AuthProvider` — login/logout/profile in localStorage; `RequireAuth` — route guard with spinner.
Single role (`AdminRole.ADMIN` only). **Mock login compares against plaintext demo credentials in
`config/brand.ts`** (documented demo, see SECURITY_AUDIT).

---

## C. Backend (`backend/`) — Phase 4 🚧 IN PROGRESS — **DOES NOT COMPILE**

### C1 Build (`pom.xml`)
Spring Boot 3.5.7 parent, Java 21, starters: web, validation, data-jpa, security, test
(+`spring-security-test`), Flyway core+postgresql, postgresql driver, jjwt 0.12.6 (api/impl/jackson),
springdoc-openapi-starter-webmvc-ui 2.8.6. Version `0.4.0`.

### C2 Configuration (`application.yml`)
Env-driven throughout (see SYSTEM_ARCHITECTURE §2.2). Defaults: dev profile, mock providers,
`ddl-auto: validate`, UTC storage + UTC Jackson, problem+json enabled, CORS allow-list,
expiry sweep enabled. `JWT_SECRET` empty → **ephemeral random secret at startup** (warn log).
Dead key: `expiry-sweep-cron` (code reads `expiry-sweep-ms`).

### C3 Migrations
- `V1__init.sql` — 13 tables + 6 seed packages (byte-identical to Phase 2 ER, D-021). Full detail in `DATABASE_DOCUMENTATION.md`.
- `V2__admin_refresh_tokens.sql` — additive refresh-token table with `family_id` (rotation reuse
  detection) — **D-025**; needed by contract A2 but no code uses the table yet.

### C4 Domain & repositories
15 entities, 14 enums, 15 repositories. Notable: partial unique index `uq_sessions_live`
(one live session/subscription), `payments.idempotency_key` UNIQUE, `payment_webhook_events`
UNIQUE(provider, provider_event_id), pessimistic-lock sweep query, `JpaSpecificationExecutor`
on subscriptions (for admin filters).

### C5 Security
- `JwtService` — HS256; access (15 min, `role` claim, jti = admin id) and refresh (30 days,
  `fam`/`seq` claims) token types; `sha256Hex()` for storage; secret ≥32 bytes enforced.
  ⚠️ **Compile error**: `issuedAt(Instant)` / `expiration(Instant)` — jjwt 0.12.6 wants `java.util.Date`.
- `JwtAuthenticationFilter` — Bearer → `ROLE_ADMIN`; invalid tokens simply leave the context empty.
- `SecurityConfig` — default-deny allow-list (see SYSTEM_ARCHITECTURE §4). CORS restricted to `/api/**`.
- `ProblemDetailHandlers` — entry point / access-denied → problem+json.

### C6 Common
- `ApiProblem` — typed 400/401/403/404/409/422/429/500 carrier (+retry-after).
- `GlobalExceptionHandler` — problem+json for ApiProblem, bean validation, catch-all 500
  (never leaks internals), traceId on every response. ⚠️ **Compile errors**: missing
  `ResponseEntity` import and an override signature that no longer matches the superclass.
- `TraceIds` — `X-Request-Id` propagation. `AuditService` — admin/system audit writer (failure-safe).
- `RateLimitService` — in-memory sliding window with `tryAcquire`/`reset`/`prune`.
  ⚠️ **Never invoked by any code** (no endpoints) and `prune()` has no scheduled caller.

### C7 Services
| Service | Status | Notes |
|---|---|---|
| `CustomerService` | ✅ complete (unwired) | find-or-create by E.164; suspended → 403 |
| `TokenService` | ✅ complete (unwired) | `TKT-XXXX-XXXX-XXXX` ≈59-bit SecureRandom, no ambiguous glyphs; SHA-256 stored; rotate on every verified purchase; generic 401s. ⚠️ `revealForResend()` **always throws 409** (hash-only storage) — conflicts with contract A22 "re-send SAME token" |
| `SmsService` | ✅ complete (unwired) | persists **redacted** body only; token never logged |
| `SubscriptionService` | ✅ complete (unwired) | activate/extend (D-007), suspend/resume/revoke/disconnect/markExpired; single-transaction activation; controller failure logged as drift, never blocks payment; audit records |
| `ExpiryService` | ✅ complete (unwired) | every 60s, pessimistic lock, revokes token/session/device/grant, keeps payments |
| `BootstrapAdmin` | ✅ complete | first admin from env (bcrypt, min 8 chars), no-op if table non-empty |

### C8 Integration adapters (SPI pattern, D-010)
| Adapter | Behaviour when selected | Honest? |
|---|---|---|
| `MockPaymentProvider` | schedules success/failure callback (phone `…0000` fails) after 4 s | ✅ dev-only, documented |
| `DarajaAdapter` | `initiate()` throws `IllegalStateException` (503-style degraded mode); `verifySignature()` returns **false** (rejects all callbacks) | ✅ honest stub |
| `MockSmsProvider` | records + returns success | ✅ dev-only |
| `AfricasTalkingAdapter` | logs error, returns failure "queued for retry" — never claims delivery | ✅ honest stub |
| `MockHotspotController` | in-memory grants/sessions, `grant_<subId>` refs, deterministic fake IPs | ✅ dev-only |
| `MikroTikAdapter` | refuses grant/revoke/disconnect with error results | ✅ honest stub |
| `NullHotspotController` | Option A soft-gate: `enforcementActive() = false` | ✅ |

⚠️ **Missing:** any `@EventListener` for `MockPaymentResultEvent` — the mock payment result is
published but nothing consumes it, so even the mock end-to-end activation cannot complete.

### C9 What is entirely absent from the backend
- **All HTTP controllers (P1–P7, A1–A30 = 37 endpoints)** — grep for
  `@RestController|@GetMapping|@PostMapping` finds only `@RestControllerAdvice`.
- Purchase/webhook processing service, auth service (A1–A3), DTO/request-validation layer,
  OpenAPI operation metadata (springdoc is on the classpath but nothing to document),
  any test source (`src/test` does not exist).

---

## D. Infrastructure — ❌ NOT PRESENT
No `docker-compose.yml`, `Dockerfile`, nginx config, `.github/workflows`, backup scripts, or
`infrastructure/` directory (README's "target repository structure" lists them — they are goals).
`.env.example` exists (root) with placeholders only.
