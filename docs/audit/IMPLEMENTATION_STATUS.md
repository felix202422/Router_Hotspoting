# Implementation Status Matrix

Statuses: **DONE** (implemented + evidence) · **PARTIAL** · **MISSING** · **BROKEN** ·
**NEEDS VERIFICATION** · **PLANNED**. Nothing is DONE without source evidence; tests are absent
so DONE means "code exists and behaves as documented when exercised", noted accordingly.

---

## 1. Documentation & planning (Phase 1–2)

| Module | Feature | Status | Evidence | Missing work | Priority |
|---|---|---|---|---|---|
| Docs | Requirements (FR/NFR) | DONE | `docs/architecture/requirements.md` | — | — |
| Docs | Use cases | DONE | `docs/architecture/use-cases.md` | — | — |
| Docs | System architecture | DONE | `docs/architecture/system-architecture.md` | — | — |
| Docs | ER diagram | DONE | `docs/database/er-diagram.md` = `V1__init.sql` | — | — |
| Docs | API contract (37 endpoints) | DONE | `docs/api/api-contract.md` | server side absent | — |
| Docs | Decision log D-001…D-026 | DONE | `docs/architecture/decision-log.md` | — | — |
| Docs | Network options / ZTE feasibility / adapter design | DONE | `docs/network/*` | — | — |
| Docs | Implementation plan / MVP scope | DONE | `docs/architecture/implementation-plan.md`, `mvp-scope.md` | — | — |

## 2. Frontend (Phase 3)

| Module | Feature | Status | Evidence | Missing work | Priority |
|---|---|---|---|---|---|
| Portal | Landing with live package list (FR-C02) | DONE | `LandingPage.tsx` → `listPackages()` | — | — |
| Portal | 3-step purchase + payment polling | DONE | `PurchasePage.tsx` (mock) | real payments (Phase 5) | HIGH |
| Portal | Token login + device fingerprint (FR-C07) | DONE | `TokenLoginPage.tsx`, mock db | backend P5 | HIGH |
| Portal | Subscription view + countdown (FR-C08) | DONE | `SubscriptionPage.tsx` | backend P6 | MEDIUM |
| Portal | Device replacement request (FR-C09) | DONE | `DeviceReplacementPage.tsx` | backend P7, admin approval A11 | MEDIUM |
| Portal | Responsive matrix (NFR-01) | DONE | 12 routes × 6 viewports, 0 overflow | — | — |
| Admin | Login + route guard | PARTIAL | `AdminLoginPage`, `RequireAuth` (client-side only) | A1 real auth; guard needs backend | HIGH |
| Admin | Overview KPIs (FR-D01) | DONE (mock) | `OverviewPage.tsx` | A5 backend | HIGH |
| Admin | Customers search/detail/suspend/disconnect | DONE (mock) | `CustomersPage.tsx` | A6–A8, A12 | HIGH |
| Admin | Packages CRUD | DONE (mock) | `PackagesPage.tsx` | A13–A16 | HIGH |
| Admin | Subscriptions filters/actions | DONE (mock) | `SubscriptionsPage.tsx` | A17, A19, A20 | HIGH |
| Admin | Payments table + resend token | DONE (mock) | `PaymentsPage.tsx` | A21, A22 | HIGH |
| Admin | Network health/sessions (never fabricates) | DONE (mock) | `NetworkPage.tsx` | A27–A29 + real MikroTik | MEDIUM |
| Admin | Analytics + CSV (TZ-day) | DONE (mock) | `AnalyticsPage.tsx`, `utils/csv.ts` | A23–A26 | MEDIUM |
| Admin | Audit log viewer | DONE (mock) | `AuditLogPage.tsx` | A30 | LOW |
| Auth | Refresh (A2) / logout (A3) calls | MISSING | never called in `api.ts`/`AuthContext` | add refresh + server logout | HIGH |
| QA | Unit/E2E tests, linter | MISSING | none configured | add vitest/eslint at minimum | HIGH |
| Live mode | End-to-end against backend | BROKEN | 35 live paths but 0 server endpoints | Phase 4 API | CRITICAL |

## 3. Backend (Phase 4) — 🚧 in progress

| Module | Feature | Status | Evidence | Missing work | Priority |
|---|---|---|---|---|---|
| Build | Compile/package | **BROKEN** | `mvn -q test` EXIT=1, 5 errors | fix imports/Date conversion | CRITICAL |
| Schema | V1 + V2 migrations | DONE | `V1__init.sql`, `V2__admin_refresh_tokens.sql` | never run (no DB creds) | — |
| Domain | 15 entities / 14 enums / 15 repos | DONE | `domain/`, `repository/` | — | — |
| Security | JWT issue/parse + filter + default-deny config | PARTIAL | `JwtService`, `SecurityConfig` | compile fix; A1–A3 service+endpoints | CRITICAL |
| Security | Refresh rotation storage (V2) | PARTIAL | table + `parseRefresh` claims | issuing/rotation/revocation service | HIGH |
| Common | RFC 9457 error handling | BROKEN | `GlobalExceptionHandler` compile errors | fix import + override signature | CRITICAL |
| Common | Audit writer | DONE | `AuditService` → `system_audit_logs` | wire into controllers when they exist | MEDIUM |
| Common | Rate limiter | PARTIAL | `RateLimitService` exists | **zero callers** — enforce in P2/P5/A1 | HIGH |
| Service | Customer find-or-create | DONE (unwired) | `CustomerService` | P2 controller | HIGH |
| Service | Token issue/rotate/generic-401 | DONE (unwired) | `TokenService` | P5 controller; resolve A22 409 conflict | HIGH |
| Service | Subscription activate/extend (D-007) | DONE (unwired) | `SubscriptionService` | webhook listener + P3 | CRITICAL |
| Service | Expiry sweep (pessimistic lock) | DONE (unwired) | `ExpiryService` @Scheduled | dead config key cleanup | MEDIUM |
| Service | SMS redaction/persistence | DONE (unwired) | `SmsService` | provider (Phase 5) | MEDIUM |
| Service | Admin bootstrap | DONE | `BootstrapAdmin` (env, bcrypt) | — | — |
| API | **All 37 endpoints (P1–P7, A1–A30)** | **MISSING** | 0 `@RestController` in repo | full web layer | CRITICAL |
| Flow | Purchase → payment → activation | **MISSING** | no purchase service, no webhook handler | build P2/P3/P4 core | CRITICAL |
| Flow | Mock payment result consumption | **BROKEN** | `MockPaymentResultEvent` published, **no listener** | add `@EventListener` | HIGH |
| Integration | Mock payment/SMS/controller | DONE (dev) | `Mock*` classes work in-process | — | — |
| Integration | Daraja / AT / MikroTik adapters | PLANNED (honest stubs) | throw/fail-closed implementations | Phase 5 + credentials + hardware | HIGH |
| Tests | Any backend test | MISSING | `src/test` absent | start with money-path tests | CRITICAL |

## 4. Infrastructure (Phase 7)

| Module | Feature | Status | Evidence | Missing work | Priority |
|---|---|---|---|---|---|
| Deploy | Docker/Compose/Nginx | MISSING | no files in repo | Phase 7 | HIGH |
| CI/CD | GitHub Actions | MISSING | no `.github/` | add build+test pipeline | HIGH |
| DB | Running PostgreSQL + migrated schema | NEEDS VERIFICATION | never run here (password unknown) | provision + Flyway | HIGH |
| Secrets | `.env.example` | DONE | root, placeholders only | real `.env` per environment | — |
| Backup | Nightly PG dumps | PLANNED | documented in `system-architecture.md` §17 | script + cron | MEDIUM |

## 5. Count

| Status | Count (approx., feature rows) |
|---|---|
| DONE | ~30 (mostly docs + frontend mock + unwired backend services) |
| PARTIAL | ~6 |
| MISSING | ~12 (all HTTP endpoints counted as 1 mega-row = CRITICAL) |
| BROKEN | 3 (backend compile, error handler, mock-payment listener gap) |
| NEEDS VERIFICATION | 2 (DB runtime, live mode E2E) |
| PLANNED | 3 (real adapters, backup, deployment) |
