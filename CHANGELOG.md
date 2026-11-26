# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 2, A5–A30 admin REST API (2026-11-26)
- Seven admin controllers + services implement the remaining contract endpoints:
  dashboard/analytics (**A5**, **A23–A26**), customers/devices/replacement queue
  (**A6–A12**), packages (**A13–A16**), subscriptions (**A17–A20**), payments and
  token resend (**A21/A22**), controller-backed network state (**A27–A29**) and
  the audit trail (**A30**). All paged lists use the shipped frontend's 1-based
  `Paged<T>{items,page,size,total}` shape; admin mutations are audited with IP.
- **A22 resend-token** re-delivers the SAME token via AES-GCM escrow of the
  active raw value (additive `V4__token_escrow.sql`, key only from
  `TOKEN_ESCROW_KEY`); revoked/expired tokens and missing escrow return 409
  with no token disclosure (D-028).
- Analytics bucket by Africa/Dar_es_Salaam days/weeks/months with zero-filled
  gaps; revenue counts verified SUCCESS payments, refunds are separate and
  `profitTzs` stays `null` until expenses are tracked (D-033). A26 streams raw
  `text/csv`; `frontend/src/services/http.ts` no longer JSON-parses it.
- **A8/A19 resume** now rotates a fresh token, re-applies the controller grant
  and sends the token SMS — an ACTIVE subscription is never left without access;
  grants use the current package limits, not the payment snapshot (D-032).

### Fixed — A5–A30 smoke findings
- Customer paging no longer uses `Sort.nullsLast()` (unsupported by Spring Data
  JPA Criteria → 500); ordering is an explicit CASE so never-seen customers
  sort last.
- Live-mode `listSubscriptions()` now forwards `expiringWithinHours` to A17;
  previously the filter was silently ignored outside mock mode.

### Verified — A5–A30 smoke against the running backend (PostgreSQL 18)
- Flyway V4 applied; every A5–A30 endpoint returned its expected status with
  **zero 500s**; no-token admin request → 401; A22 → 204 for an active escrow
  and 409 for a revoked subscription; network endpoints showed MOCK controller
  facts only. `mvn -q test` green.

### Added — Phase 2, P1–P7 customer portal API (2026-11-26)
- `PortalController` + `PortalService`: **P1** `GET /packages` (DB-only active
  packages), **P5** `POST /auth/token-login` (generic 401 for every invalid
  token, 5/min per IP + token prefix, device binding, real controller grant only),
  **P6** `GET /subscriptions/current`, **P7** `POST /device-replacement-requests`
  (PENDING, exact contract message). P6/P7 accept both `X-Access-Token` and
  `Authorization: Bearer`; P7's body token is authoritative (D-030).
- `PurchaseController` + `PurchaseService`: **P2** `POST /purchases` (E.164
  normalization, 1/30 s + 10/hour per phone, DB-only packages, opaque `pur_`
  reference), **P3** `GET /purchases/{purchaseId}` (no phone, token or PII).
- `WebhookController` + `PaymentWebhookIngestionService`: **P4**
  `POST /webhooks/payments/daraja` — rate limit → optional IP allowlist → HMAC
  verify (env-only secret) → secret-free envelope → replay guard → event row in
  its own transaction → shared idempotent result core. Replays return 200
  `IGNORED`; invalid signature 401, malformed 400 (D-029).
- `MockPaymentProvider.verifySignature` performs dev-only HMAC-SHA256 with
  `DARAJA_WEBHOOK_SECRET` and fails closed when unset; Daraja stays fail-closed
  until Phase 5. `WEBHOOK_ALLOWED_IPS` and mock callback delay are env-driven.

### Fixed — P1–P7 integration smoke findings (D-031)
- Token rotation now flushes instead of clearing the persistence context, so
  verified payments no longer break controller grant/SMS with a detached
  Customer; P3/P6 map lazy associations inside read-only transactions; blank
  tokens yield the same generic 401 as invalid/expired ones.

### Verified — P1–P7 smoke (2026-11-26)
- `mvn -q test` green; full HTTP smoke: P1 200; P2/P3 SUCCESS and FAILED paths;
  P3 no PII; P4 200 `PROCESSED` then `IGNORED` replay, 401 bad/no signature,
  400 malformed; P5 invalid 401, `401×5 → 429`, valid CONNECTED, 409 device
  mismatch; P6 both header forms 200; P7 201/400/401; revoked token 401.
  DB invariants: one active device/session per subscription, one PENDING
  replacement, webhook events persisted. No 500s in the final run.

### Added — Phase 2, A1–A4 admin auth (2026-11-26)
- `AuthController` + `AdminAuthService`: **A1** `POST /api/v1/admin/auth/login`
  (bcrypt, one generic 401 for unknown-email vs wrong-password — no account
  enumeration; disabled account → 403; rate limit 5/min per IP with reset on
  success), **A2** `POST …/refresh` (rotation family per login, reuse detection:
  presenting an already-rotated token revokes the whole family and forces
  re-login), **A3** `POST …/logout` (idempotent 204), **A4** `GET …/me`.
  Response shape matches the frontend `AuthResponse`/`AdminProfile` exactly
  (accessToken, refreshToken, expiresIn, profile{id,email,fullName,role}).
- DTOs `LoginRequest`, `RefreshRequest`, `AuthResponse`, `ProfileDto`;
  `AdministratorRepository.findByEmailIgnoreCase` for case-insensitive login.
- `SecurityConfig` needed no change: its default-deny allow-list already
  permits exactly login/refresh/logout; everything else under
  `/api/v1/admin/**` requires ROLE_ADMIN.

### Fixed — three runtime bugs found at the first boots (compile was green)
- `GlobalExceptionHandler` no longer extends `ResponseEntityExceptionHandler`:
  the superclass's inherited `@ExceptionHandler(MethodArgumentNotValidException)`
  collided with the custom validation handler — **application context failed to
  start** ("Ambiguous @ExceptionHandler method mapped"). Rewritten standalone
  with explicit handlers (validation 400, malformed body 400, type mismatch 400,
  missing param 400, 405, 415, 404, catch-all 500) — all RFC 9457 problem+json.
- `ExpiryService.scheduledSweep()` is now `@Transactional`: the scheduler
  self-invoked `sweepOnce()` bypassing the proxy, so the pessimistic-lock query
  ran with no transaction ("Query requires transaction be in progress",
  logged every 60 s).
- **JDBC type mismatch (jsonb/inet)**: Hibernate binds `String` parameters as
  `varchar`, which PostgreSQL rejects for `JSONB`/`INET` columns — every audit
  insert failed (`column "after_json" is of type jsonb but expression is of type
  character varying`). Fixed with `@ColumnTransformer(write = "cast(? as jsonb|inet)")`
  on `AuditLog.beforeJson/afterJson/ipAddress`, `ActiveSession.ipAddress`,
  `WebhookEvent.payload` (casts verified against PostgreSQL 18 before use).

### Fixed — transaction-poisoning patterns (caught by the A1–A4 smoke test)
- `AuditService` writes audit rows in their **own** transaction
  (`REQUIRES_NEW`): the previous catch-inside-the-shared-transaction still
  left it rollback-only, so a failed audit insert turned the whole login into
  `UnexpectedRollbackException` 500.
- `AdminAuthService` revokes refresh-token families (A2 reuse detection,
  disabled account) in their **own** transaction: the following `throw 401/403`
  used to roll the revocation back — the smoke test proved a replayed token
  still worked after "reuse detected"; it now correctly returns 401 for every
  token in the family.

### Verified — A1–A4 smoke suite against the running backend (PostgreSQL 18)
- login → me → refresh (rotated) → replay old token → **401** → replay new
  token → **401** (family revoked) → logout → **204**; `/me` without token →
  **401**; wrong password → **401** generic; 6 rapid bad logins →
  `401,401,401,401,401,429` and a correct login is also blocked during the
  lockout. Flyway V1→V2→V3 applied; audit rows confirmed in
  `system_audit_logs` (jsonb + inet intact); expiry sweep runs without errors.

### Changed — Design refresh: green "Wi-Fi hotspot" kit (D-026)
- Tailwind theme remapped from navy/electric-blue to the owner-supplied green reference:
  `mint-*` page surfaces, `forest-*` headers/sidebar/hero panels, `leaf-*` accents,
  `citrus-*` CTAs. Class tokens renamed `navy-*`→`forest-*`, `electric-*`→`leaf-*`
  across 22 files (mechanical rename, no layout changes).
- Primary buttons are citrus orange with dark forest text (≈7:1 contrast, NFR-02/WCAG AA);
  portal header is now a light-lime bar with an orange Wi-Fi chip; admin sidebar keeps the
  dark forest panel with a citrus active-nav; landing hero is a dark forest panel with
  citrus icon chip; charts use leaf/citrus series colors instead of `#2563EB`.
- `index.html` theme-color → `#163019`; body background → mint.

### Fixed
- `DataTable`: stacked-card view now extends to `<1024px` (`md`→`lg`) — dense admin tables
  (Subscriptions, Network) overflowed the 768×1024 viewport, violating NFR-01's
  "never horizontal scroll" rule.

### Verified
- `npm run build` — tsc clean + Vite production build.
- Responsive matrix: 12 routes × 6 viewports (360×800, 390×844, 768×1024, 1024×768,
  1366×768, 1920×1080) — zero horizontal overflow everywhere; zero console errors on
  portal landing, admin login/overview/analytics.

### Added — Phase 1 stabilization (2026-11-26, after technical audit)
- Backend **compiles for the first time**: fixed the 5 compile errors found by the audit —
  missing imports (`GlobalExceptionHandler`, `GrantRequest`) and jjwt 0.12.6
  `Instant`→`Date` conversions (`JwtService`). `mvn -q test` now exits 0.
- `PaymentWebhookService` — idempotent payment-result core (FR-M02/M03): consumes the
  previously-orphaned `MockPaymentResultEvent` (audit KI-2), first-verified-result-wins
  guard against replays, single activation path (`SubscriptionService.activateOrExtend`)
  shared with the future Daraja webhook — no separate fake-success branch.
- `RateLimitService.scheduledPrune()` — scheduled bucket housekeeping (audit KI-4, partial).
- Flyway `V3__session_ip_nullable.sql` (D-027): `active_sessions.ip_address` may be NULL;
  placeholder `10.10.0.2` removed from the grant flow (FR-D06, audit KI-6).
- `application.yml`: dead `expiry-sweep-cron` key replaced with the `expiry-sweep-ms` key
  `ExpiryService` actually reads (audit KI-7).

### Added — Technical audit deliverables (2026-11-25)
- `docs/audit/` — 13 documents: project overview, system architecture, module docs,
  database docs (ER), API docs, frontend docs, security audit, testing report,
  implementation status matrix, known issues, improvement roadmap, development guide and
  the master system documentation. Read-only audit: no application code was modified
  while it ran; every claim is traceable to source evidence and executed commands.

### Added — Phase 4: Backend Development (in progress)
- Spring Boot 3.5.7 / Java 21 project: `pom.xml` (validation, springdoc, jjwt 0.12.6,
  Flyway), env-driven `application.yml`, `.env.example`.
- Flyway migrations: `V1__init.sql` (Phase 2 ER baseline, D-021) +
  `V2__admin_refresh_tokens.sql` (additive admin refresh-token storage, D-025).
- Domain layer: 15 JPA entities + 14 enums mirroring the ER; 15 Spring Data repositories.
- Security: `JwtService`, `JwtAuthenticationFilter`, `SecurityConfig`,
  `ProblemDetailHandlers` (RFC 9457).
- Common: `ApiProblem`, `GlobalExceptionHandler`, `TraceIds`, `RateLimitService`,
  `AuditService`.
- Integration adapters (mock-first): payment (mock + Daraja), SMS (mock + Africa's Talking),
  hotspot controller (mock / null / MikroTik).
- Core services: `CustomerService`, `TokenService`, `SmsService`, `SubscriptionService`,
  `ExpiryService` (pessimistic-lock sweep, `@Scheduled` every minute),
  `BootstrapAdmin` (creates the first admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars).

## [0.3.0] — 2026-11-24

### Added — Phase 3: Frontend Development (approved 2026-11-24, D-024)
- Vite + React 18 + TypeScript (strict) + Tailwind build config with pinned dependencies,
  `@` path alias, navy/electric design tokens, 44px tap targets, no global horizontal overflow.
- `frontend/src/config/brand.ts` — single source of truth for business identity (placeholder
  brand until owner supplies name/logo); packages are NEVER hardcoded in the frontend.
- `frontend/src/types` — full mirror of the Phase 2 API contract, incl. `ApiError` (RFC 9457).
- `frontend/src/services/api.ts` — single API facade with mock/live modes switched by
  `VITE_API_MODE`; mock backend simulates idempotent purchases, D-007 extension rule,
  token rotation, rate limiting, TZ-day (Africa/Dar_es_Salaam) analytics, device binding.
- Shared component library (16 components): Button, Card, Badge/StatusBadge, StatCard,
  Input/Field/Textarea/Select, Modal, Drawer, ConfirmDialog, responsive DataTable
  (table ≥768px, stacked cards below — never horizontal scroll), Pagination, Stepper,
  Toast, Spinner, EmptyState, PageHeader.
- Auth: `AuthProvider` + `RequireAuth` route guard (admin), token storage in localStorage.
- Layouts: `PortalLayout` (mobile-first) and `AdminLayout` (≥1024px sidebar, <1024px
  hamburger drawer).
- Customer portal pages: Landing, Purchase (3-step + payment polling), Token login,
  Subscription status, Device replacement, dev-only Mock SMS inbox.
- Admin pages: Login, Overview (KPIs + 30-day revenue chart), Customers, Packages,
  Subscriptions, Payments, Network (controller-backed sessions), Analytics (revenue/package/
  customer + CSV export), Audit log.

### Fixed
- Mock admin login now persists the access token (previously only the live branch did),
  so a page reload keeps the administrator signed in instead of bouncing to the login page.

### Verified
- `npm run build` — tsc clean + Vite production build (735 kB / 206 kB gzip; chunk-size
  warning only).
- Browser smoke test: portal landing + admin login → Overview render with zero console errors.
- Responsive harness: 15 portal checks (5 routes × 360/768/1920) and 16 admin checks
  (8 routes × 360/1366) — all `overflowX = 0`, all pages render expected headings.

## [0.1.0] — 2026-11-23

### Added
- Phase 1 documentation set:
  - ZTE G5TS hardware feasibility report with on-site verification checklist (T1–T9).
  - Network architecture options (A soft-gate, B1 MikroTik, B2 Pi, C ZTE-bridge) with
    comparison and recommendation.
  - Hotspot controller adapter design (`HotspotController` interface: MikroTik/Mock/Null).
  - MVP scope and explicit non-goals.
  - Decision log (D-001 … D-017) capturing all owner decisions.
  - Implementation plan for Phases 2–7 with API contract outline, ER draft and risk register.
- Project README, license (MIT, pending confirmation), gitignore.

### Notes
- No application code written yet — paused for owner approval per agreed session scope
  (decision D-008).

## [0.2.0] — 2026-11-23

### Added — Phase 2: System Planning and Design (approved)
- `docs/architecture/requirements.md` — FR/NFR baseline with full traceability to the master
  prompt (FR-C/P/A/S/M/T/D/R + NFR-01…10).
- `docs/architecture/use-cases.md` — 18 use cases, sequence narratives (purchase, token login,
  expiry, replacement, reconciliation) and testable business-rule invariants.
- `docs/architecture/system-architecture.md` — component + deployment diagrams (Option B1),
  modular-monolith backend layout, security architecture, environment profiles.
- `docs/database/er-diagram.md` — complete 13-table schema with constraints, indexes,
  idempotency and concurrency rules (basis for Flyway `V1__init.sql`).
- `docs/api/api-contract.md` — full REST contract: 7 public + 30 admin endpoints, error
  envelope, rate limits, versioning.
- `docs/architecture/ui-wireframes.md` — portal (mobile-first) and admin (desktop-first)
  wireframes with responsive behaviour per required viewport.

### Changed
- Decision log: D-018 (Phase 2 approved), D-019 (MIT license confirmed), D-020 (Option B1
  committed as build target), D-021 (Phase 2 baselines binding for Phases 3–4).
- README phase status: Phase 2 complete; doc index expanded.
