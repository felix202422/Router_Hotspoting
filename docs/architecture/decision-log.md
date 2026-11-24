# Decision Log

**Phase:** 3 — Frontend Development (append-only log since Phase 1)
**Rule:** every architectural decision is recorded here with rationale. Append-only; supersede
by adding a new entry referencing the old ID.

| # | Date | Decision | Rationale / source | Status |
|---|---|---|---|---|
| D-001 | 2026-11-23 | Customers connect **directly to the ZTE G5TS Wi-Fi** (single AP on-site) | Owner answer | ✅ Confirmed |
| D-002 | 2026-11-23 | Owner is **open to one low-cost enforcement device** if Phase 1 proves the ZTE cannot enforce access | Owner answer; ZTE cannot enforce (feasibility report) | ✅ Confirmed |
| D-003 | 2026-11-23 | **Payment provider v1: M-Pesa (Vodacom Daraja), sandbox-first**; live credentials pending from owner | Owner answer; master prompt §8 (no invented APIs) | ✅ Confirmed — credentials pending |
| D-004 | 2026-11-23 | **SMS provider v1: Africa's Talking, sandbox-first**; credentials pending | Owner answer; master prompt §9 | ✅ Confirmed — credentials pending |
| D-005 | 2026-11-23 | **Production hosting: on-site machine** at the hotspot (Docker Compose: backend, postgres, nginx) | Owner answer; solves pre-payment portal reachability (walled garden) | ✅ Confirmed |
| D-006 | 2026-11-23 | **Device replacement = admin-approved recovery only** (no OTP; every replacement audited) | Owner answer; master prompt §4E | ✅ Confirmed |
| D-007 | 2026-11-23 | **Renewal policy = EXTEND**: remaining time preserved, new duration added on top (any package) | Owner answer; master prompt §6 | ✅ Confirmed |
| D-008 | 2026-11-23 | **This session: Phase 1 docs only → pause for explicit approval** before any code | Owner answer | ✅ Confirmed |
| D-009 | 2026-11-23 | **Recommended network architecture: Option B1** — MikroTik RouterOS Hotspot gateway behind the untouched ZTE; Option C (ZTE bridge) gated on on-site test T7; Option A (soft gate) is zero-budget fallback only | `network-architecture-options.md` | ⏳ Pending owner approval |
| D-010 | 2026-11-23 | **Modular `HotspotController` adapter** (MikroTik / Mock / Null) — business logic never touches vendor APIs | Master prompt §3; `hotspot-adapter-design.md` | ✅ Approved in principle |
| D-011 | 2026-11-23 | Reporting timezone **Africa/Dar_es_Salaam**; revenue = verified SUCCESS payments only, idempotent against duplicate webhooks | Master prompt §12 | ✅ Confirmed |
| D-012 | 2026-11-23 | Token security: random secure token → **hash stored** → sent only by SMS → rate-limited validation → no tokens in logs | Master prompt §6 | ✅ Confirmed |
| D-013 | 2026-11-23 | Stack locked: React+TS+Vite+Tailwind / Java 21 Spring Boot / PostgreSQL+Flyway / Docker+Nginx; no microservices | Master prompt §2 | ✅ Confirmed |
| D-014 | 2026-11-23 | Source of truth pushed to **https://github.com/felix202422/Router_Hotspoting** | Owner instruction | ✅ Confirmed |
| D-015 | 2026-11-23 | License: **MIT** for code (placeholder pending owner preference — may be changed before public release) | Repo structure requires a LICENSE | ⏳ Pending owner confirmation |
| D-016 | 2026-11-23 | One authorized device + one concurrent session per subscription; MAC treated as weak hint only | Master prompt §7 | ✅ Confirmed |
| D-017 | 2026-11-23 | No financial records deleted on expiry; data-retention/deletion process deferred to v1.1 with legal review | Master prompt §11 | ✅ Confirmed |
| D-018 | 2026-11-23 | **Phase 2 plan approved by owner** ("approve… begin phase 2") — requirements, use cases, system architecture, ER, API contract, wireframes baselined | Owner instruction | ✅ Approved |
| D-019 | 2026-11-23 | **D-015 confirmed: MIT license** approved as part of the Phase 2 approval | Owner approval message (applies to "all the works") | ✅ Confirmed |
| D-020 | 2026-11-23 | **D-009 provisional → Option B1 committed as the build target**; MikroTik adapter is the production `HotspotController`. T1–T9 results may still trigger a re-evaluation (Option C) **before Phase 5 hardware config**, never before Phases 3–4 (adapter isolation makes the switch config-only) | Owner approval of plan recommending B1 | ✅ Committed |
| D-021 | 2026-11-23 | **Phase 2 baselines are binding inputs for Phase 3 (UI) and Phase 4 (API/DB)**: `requirements.md`, `use-cases.md`, `system-architecture.md`, `er-diagram.md` (→ `V1__init.sql`), `api-contract.md`, `ui-wireframes.md` | Phase 2 deliverables | ✅ Approved |
| D-022 | 2026-11-24 | **Frontend consumes a single API facade** (`services/api.ts`) with mock/live modes switched by `VITE_API_MODE`; mock backend simulates the Phase 2 contract (idempotent purchase, D-007 extension, token rotation, rate limits, TZ-day analytics) so Phase 3 is verifiable without a backend | Phase 3 implementation; master prompt A17 (mock explicitly not production) | 🧪 Implemented — pending approval |
| D-023 | 2026-11-24 | **Mock admin login persists access + profile in localStorage identically to live mode** (bug fix: reload previously bounced admins to the login page because the mock branch skipped token storage) | Phase 3 browser smoke test finding | 🛠 Fixed in 0.3.0 |

## Open items (blockers for later phases, not for Phase 1 approval)

| Item | Needed by | Owner action |
|---|---|---|
| ZTE WebUI verification checklist T1–T9 | Before Phase 5 hardware config (does NOT block Phases 3–4, D-020) | Run tests in `zte-g5ts-feasibility.md` §6, send screenshots |
| Daraja sandbox credentials | Phase 5 | Register/obtain from Vodacom; share via secure channel, never in git |
| Africa's Talking credentials | Phase 5 | Create account/sandbox key |
| Business name, logo, support contact, package examples with real TZS prices | Phase 3 (portal UI) — **placeholder `HotspotName` + demo prices used in Phase 3**; update `frontend/src/config/brand.ts` + package rows when supplied | Provide branding assets before launch |
| MikroTik purchase decision | Phase 5 | Approve Option B1 cost (or trigger T7 test for Option C) |
