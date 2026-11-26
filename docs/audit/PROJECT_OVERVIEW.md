# Project Overview

**Audit date:** 2026-11-25 · **Auditor role:** Senior Software Architect / System Analyst / Technical Auditor
**Scope:** Full existing codebase + documentation, evidence-based, read-only (no application code modified)

---

## 1. System purpose

A **paid Wi-Fi hotspot management system** for a small hotspot business in Tanzania. Customers
connect to a captive portal, pick an internet package, pay with M-Pesa (mobile money), receive an
access token by SMS, and are granted controlled internet access through a hotspot controller.
Administrators manage packages, customers, payments, subscriptions, sessions and revenue from a
dashboard.

Core business rules (binding, from the master prompt and `docs/architecture/decision-log.md`):

1. **No internet access before verified payment** (FR-C04).
2. **No OTP** in the normal customer registration/reconnection flow (FR-C10).
3. **No fake payment/SMS integrations presented as production** (FR-M06/FR-T01, D-003/D-004):
   all real providers are sandbox-first and currently honest stubs.
4. **Financial history never deleted on expiry** (NFR-06, FR-A06).
5. **Packages/prices come from the database — never hardcoded in the frontend** (FR-C02).
6. **All secrets via environment variables** (master rule 6).

## 2. Current development phase

| Phase | Subject | Status (per repo docs + verified here) |
|---|---|---|
| 1 | Requirements & hardware feasibility | ✅ Complete & approved (commits `5cab215`, docs present) |
| 2 | System planning & design | ✅ Complete & approved (`42e0a48`) |
| 3 | Frontend development (mock API mode) | ✅ Complete & approved (`fefa0c9`, `9bd4b7f`) |
| 4 | Backend development | 🚧 **In progress — does not compile; no HTTP endpoints exist** |
| 5 | Integrations (M-Pesa / SMS / MikroTik) | ⏳ Not started (adapters are honest stubs) |
| 6 | Testing | ⏳ Not started — **zero test files exist anywhere** |
| 7 | Deployment (Docker/Nginx) | ⏳ Not started — no Docker/CI files exist |

Git state at audit time: branch `main`, latest commit `9bd4b7f`, with **uncommitted work**: the
Phase 4 backend directory (`backend/`, untracked), `.env.example`, and a green-theme frontend
restyle (28 modified files + `CHANGELOG.md` + `decision-log.md`).

## 3. What the system actually does today

- **Fully functional (verified):** the React frontend in **mock mode** (`VITE_API_MODE` unset) —
  an in-memory simulation of the whole Phase 2 API contract: package browsing, 3-step purchase
  with payment polling, token login, subscription view, device-replacement request, and a complete
  admin console (overview KPIs, customers, packages, subscriptions, payments, network, analytics
  with CSV export, audit log). `npm run build` passes (EXIT=0).
- **Partially built:** the Spring Boot backend — domain model, repositories, security skeleton,
  services and integration adapters exist, **but the project does not compile** and **contains zero
  REST controllers**, so not a single API endpoint is served.
- **Not started:** real provider integrations, hardware integration, tests, CI/CD, containers.

## 4. Languages, frameworks, tools

| Layer | Technology (verified in `frontend/package.json`, `backend/pom.xml`) |
|---|---|
| Frontend | TypeScript ~5.6 (strict), React 18.3, Vite 5.4, Tailwind CSS 3.4, React Router 6.28, Recharts 2.13, lucide-react 0.454 |
| Backend | Java 21, Spring Boot 3.5.7 (Web, Validation, Data-JPA, Security, Test), Flyway, PostgreSQL driver, jjwt 0.12.6, springdoc-openapi 2.8.6 |
| Database | PostgreSQL (schema via Flyway `V1__init.sql`, `V2__admin_refresh_tokens.sql`); `ddl-auto: validate` |
| Build | npm (`dev`/`build`/`preview`), Maven (`mvn compile`/`mvn test`) |
| Integrations (planned) | M-Pesa Daraja, Africa's Talking, MikroTik RouterOS (all stubs now) |

## 5. Documentation set (Phase 1–3, all present)

`docs/architecture/` (requirements, use-cases, system-architecture, ui-wireframes, decision-log,
implementation-plan, mvp-scope) · `docs/database/er-diagram.md` · `docs/api/api-contract.md` ·
`docs/network/` (zte-g5ts-feasibility, network-architecture-options, hotspot-adapter-design) ·
`README.md` · `CHANGELOG.md` · `LICENSE` (MIT) · `.env.example`.

This audit's deliverables live in **`docs/audit/`** (this directory) and do not modify any of the above.

## 6. Honest top-level assessment

| Area | Verdict |
|---|---|
| Documentation & design | Strong, phase-gated, decision-logged (D-001…D-026) |
| Frontend (mock mode) | Functional, responsive-verified, builds clean |
| Frontend (live mode) | Code paths exist but will 404/500 — backend has no endpoints |
| Backend | **Broken (compile errors) and incomplete (no controllers)** |
| Database design | Sound, normalized, indexed, constraint-rich |
| Tests | **None exist in either tier** |
| Deployment assets | **None exist** (README's target structure promises them) |

See `IMPLEMENTATION_STATUS.md` for the full status matrix and `KNOWN_ISSUES.md` for the issue list.
