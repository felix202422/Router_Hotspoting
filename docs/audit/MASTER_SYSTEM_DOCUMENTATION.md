# Master System Documentation

**Paid Wi-Fi Hotspot Management System** — executive summary and index of the complete audit.
Audit date: 2026-11-25 · read-only · no application code modified.

---

## 1. What this system is

A hotspot business platform for Tanzania: customers buy internet packages through a captive
portal, pay by M-Pesa, receive an access token by SMS, and are granted controlled Wi-Fi access
through a hotspot controller (planned: MikroTik behind an untouched ZTE G5TS uplink — Option B1,
D-009/D-020). Administrators manage packages, customers, payments, subscriptions, sessions,
analytics and an audit trail from a web console.

**Binding rules** (all verified against code where applicable):
no access before verified payment · no OTP in normal flows · no fake payment/SMS presented as
production · financial history preserved · packages never hardcoded in the frontend · secrets
only in env vars · responsive at six viewports · honest limitations.

## 2. One-paragraph truth

The **design and documentation are complete and high quality** (Phases 1–2, decision-logged
D-001…D-026). The **frontend is complete and functional in mock mode** (Phase 3, builds clean,
responsive-verified) with live-mode code paths already written against the 37-endpoint contract.
The **backend (Phase 4) is mid-flight: solid domain/services/security/adapters exist but it does
not compile, contains zero HTTP endpoints, has no tests, and its mock-payment event is
unconsumed** — so no API, no real auth, and no purchase flow actually runs. **Real integrations
(M-Pesa, SMS, MikroTik) are honest fail-closed stubs** awaiting Phase 5. **Deployment assets,
CI, and the entire test suite do not exist.**

## 3. Deliverables index (this directory, `docs/audit/`)

| # | Document | Contents |
|---|---|---|
| 1 | `PROJECT_OVERVIEW.md` | purpose, phases, what runs today, tech stack |
| 2 | `SYSTEM_ARCHITECTURE.md` | target vs implemented topology, component map, security & data flows |
| 3 | `MODULE_DOCUMENTATION.md` | every module: docs, frontend, backend packages, adapters, gaps |
| 4 | `DATABASE_DOCUMENTATION.md` | 14 tables, constraints, indexes, Mermaid ER, DB findings D-1…D-9 |
| 5 | `API_DOCUMENTATION.md` | all 37 contract endpoints, per-endpoint status, integration status, mismatches |
| 6 | `FRONTEND_DOCUMENTATION.md` | 16 routes, 16 components, state/auth flows, responsive evidence, gaps |
| 7 | `SECURITY_AUDIT.md` | control inventory, findings SEC-1…SEC-11, secret-scan results |
| 8 | `TESTING_REPORT.md` | executed commands + real results, untested-risk map, blocked checks |
| 9 | `IMPLEMENTATION_STATUS.md` | full DONE/PARTIAL/MISSING/BROKEN/NEEDS VERIFICATION/PLANNED matrix |
| 10 | `KNOWN_ISSUES.md` | KI-1…KI-16 with evidence, impact, fixes, priorities |
| 11 | `IMPROVEMENT_ROADMAP.md` | 6 phases, sequenced, no-rebuild strategy |
| 12 | `DEVELOPMENT_GUIDE.md` | setup, env vars, workflows, conventions, gates, troubleshooting |
| 13 | `MASTER_SYSTEM_DOCUMENTATION.md` | this file |

## 4. System picture

```
┌──────────────────────────── EXISTING & WORKING ────────────────────────────┐
│ • Phase 1–2 documentation (requirements, architecture, ER, API contract,   │
│   network options, decisions D-001…D-026)                                  │
│ • React frontend in MOCK mode: portal (landing/buy/token/sub/replacement)  │
│   + full admin console (overview/customers/packages/subs/payments/network/ │
│   analytics/audit) — builds, responsive-verified                           │
│ • Frontend LIVE-mode client (35 paths, http wrapper, token storage)        │
│ • Backend source: 15 entities, 15 repos, JWT security skeleton, 6 services,│
│   7 integration adapters (mock ×3 work; real ×3 honest stubs), Flyway V1+V2│
└────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────── MISSING / BROKEN ──────────────────────────────┐
│ BROKEN: backend compilation (5 errors) · unconsumed mock-payment event     │
│ MISSING: all 37 REST endpoints · purchase/webhook core · A2/A3 auth flow   │
│          · rate-limit wiring · every test · linter · Docker/CI/nginx       │
│ PLANNED: M-Pesa Daraja · Africa's Talking · MikroTik · deployment/backup   │
└────────────────────────────────────────────────────────────────────────────┘
```

## 5. Technology stack (verified)

- **Frontend:** React 18.3 · TypeScript ~5.6 strict · Vite 5.4 · Tailwind 3.4 (green kit D-026) ·
  React Router 6.28 · Recharts 2.13 · lucide-react.
- **Backend:** Java 21 · Spring Boot 3.5.7 (Web/Validation/Data-JPA/Security/Test) · Flyway ·
  PostgreSQL · jjwt 0.12.6 · springdoc 2.8.6 · Maven.
- **Database:** PostgreSQL, 14 tables, integer TZS money, UTC timestamptz, partial unique index
  for one-live-session, idempotency + webhook-replay uniques, audit JSONB diffs.
- **Auth:** stateless HS256 JWT (15-min access / 30-day refresh w/ rotation design), bcrypt
  bootstrap admin, default-deny `SecurityConfig`, CORS allow-list, no CSRF (Bearer tokens).
- **Integrations:** SPI pattern (`PaymentProvider`, `SmsProvider`, `HotspotController`) with
  env-selected adapters; all real ones fail closed until Phase 5.

## 6. Evidence of executed checks (commands)

| Command | Result |
|---|---|
| `git status --porcelain` (baseline & final) | pre-existing: 28 modified + `.env.example` + `backend/` untracked; audit added only `docs/audit/*` |
| `mvn -q test` (backend) | **EXIT=1** — 5 compilation errors (KI-1) |
| `npm run build` (frontend) | **EXIT=0** — 2,215 modules, 735 kB JS / 29 kB CSS |
| `glob **/*{test,Test,spec,Spec}*` | **no files** (zero tests) |
| grep `@RestController\|@GetMapping\|@PostMapping` | **1 hit** — `@RestControllerAdvice` only (0 endpoints) |
| grep `tryAcquire(\|prune(` | definitions only (rate limiter unused) |
| grep `MockPaymentResultEvent\|@EventListener` | publish + record only (no listener) |
| grep `admin/auth/refresh\|auth/logout` (frontend) | no call sites (A2/A3 unused) |
| grep `expiry-sweep-cron\|expiry-sweep-ms` | yml key ≠ code key (dead config) |
| grep hardcoded secrets (ts/tsx/yml/java/sql/md/json) | **1 hit** — documented mock demo password (value not reproduced) |
| glob `.env*`, `application-*.yml`, Docker/CI/nginx files | none (only `.env.example`, `application.yml` placeholders) |
| Responsive matrix 12 routes × 6 viewports | 0 overflow, 0 console errors (harness removed after) |

**Could not complete:** DB migration/runtime tests (no credentials + compile failure), API smoke
tests (no endpoints), Lighthouse/a11y automation and screenshots (no browser tooling), performance
measurement (stack doesn't run).

## 7. Top 5 weaknesses (ranked)

1. **CRITICAL — backend doesn't compile & has no API layer** (KI-1, KI-9): the entire server
   tier is non-functional.
2. **CRITICAL — zero tests anywhere** (KI-8): the money path is unverified by construction.
3. **HIGH — auth lifecycle half-built** (KI-3, KI-10): no refresh/logout flow; sessions break
   at 15 minutes in live mode.
4. **HIGH — payment flow disconnected** (KI-2): mock result event has no consumer; webhook core
   unwritten; A22 resend contradicts its own contract (KI-5).
5. **HIGH — no enforcement of contract rate limits** (KI-4) and **fake session IP** (KI-6)
   honesty gap.

## 8. Recommended next phase

**Phase 1 (stabilize) → Phase 2 (API layer)** exactly as detailed in `IMPROVEMENT_ROADMAP.md`:
fix the 5 compile errors, wire the mock-payment listener, resolve the A22 decision, then build
A1–A4 auth and the P1–P7/A5–A30 endpoints against the existing contract, adding tests with the
money path first. MikroTik/Daraja/SMS (Phases 3–4) proceed in parallel once credentials and
hardware are available. Nothing in the audit suggests any rewrite — the architecture is right;
it needs completion and verification.

---

*Generated by the read-only technical audit. All claims traceable to source files and commands
listed above. No secrets, credentials, or user data are reproduced in any audit document.*
