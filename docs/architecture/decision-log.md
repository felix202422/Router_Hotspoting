# Decision Log

**Phase:** 1 — Requirements and Hardware Feasibility
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

## Open items (blockers for later phases, not for Phase 1 approval)

| Item | Needed by | Owner action |
|---|---|---|
| ZTE WebUI verification checklist T1–T9 | Architecture lock (D-009 final) | Run tests in `zte-g5ts-feasibility.md` §6, send screenshots |
| Daraja sandbox credentials | Phase 5 | Register/obtain from Vodacom; share via secure channel, never in git |
| Africa's Talking credentials | Phase 5 | Create account/sandbox key |
| Business name, logo, support contact, package examples with real TZS prices | Phase 3 (portal UI) | Provide branding assets |
| MikroTik purchase decision | Phase 5 | Approve after reviewing Option B1 cost (or trigger T7 test for Option C) |
