# MVP Scope and Non-Goals

**Phase:** 1 — System Planning and Design
**Status:** Draft for approval
**Date:** 2026-11-23

---

Purpose: prevent scope explosion across the nine system components. Anything not listed as
IN is out of MVP and scheduled (or explicitly rejected) in the table below.

## 1. IN — MVP (v1.0)

| Component | MVP contents |
|---|---|
| **Customer portal** | Landing/branding, package list (from DB), purchase flow (phone number → Daraja STK push → verification → token by SMS), "Already have an active subscription?" token login, subscription info view (package, activation/expiry, status, device status), device-replacement **request** (admin-approved), contact/support block. Mobile-first, tested at all six required viewports. |
| **Admin dashboard** | JWT login, overview KPIs (revenue today/week/month/year/total, active subs, connected customers, purchases, expired, failed/pending payments), customer management (search by phone, history, current sub, device, suspend, approve device replacement), package CRUD, subscription management (view/suspend/revoke/disconnect), payment history table, analytics (date/package/status filters, charts, CSV export), network page bound to real controller data only, audit log viewer. Desktop-first, fully responsive. |
| **Backend API** | All portal + admin REST endpoints (contract outline in `implementation-plan.md`), JWT admin auth, RBAC (ADMIN), validation, rate limiting (token login + payment initiation), webhook signature verification, scheduled expiration job, revenue analytics queries in `Africa/Dar_es_Salaam`. |
| **Database** | Full normalized schema (entities of master prompt §16) with Flyway migrations, constraints, indexes. |
| **Payments** | `PaymentProvider` abstraction + **M-Pesa Daraja adapter (sandbox-first)**: STK push initiation, status polling, verified webhook, idempotent processing, full transaction records. Statuses: PENDING/SUCCESS/FAILED/REFUNDED. |
| **SMS** | `SmsProvider` abstraction + **Africa's Talking adapter (sandbox-first)**: token SMS, purchase confirmation, optional expiry notice, delivery status recording, admin "resend token" action, retry on transient failure. |
| **Hotspot integration** | `HotspotController` interface + **MikroTik adapter** + Mock + Null (soft-gate) — see `hotspot-adapter-design.md`. One-session-per-subscription, client isolation, per-package rate limits. |
| **Infra** | Docker Compose (backend, postgres, nginx, frontend), `.env.example`, HTTPS via reverse proxy, structured logging, DB backup script + runbook, deployment doc. |

## 2. OUT of MVP — scheduled

| Item | Target |
|---|---|
| Airtel Money + Mixx by Yas adapters | v1.1 (abstraction already in place) |
| Real-credential live testing (Daraja prod, AT prod) | v1.1 — requires owner's merchant/API accounts |
| Profit/expense tracking (`operational_expenses`) | v1.1 — schema stub only in MVP; gross revenue ≠ profit |
| Multiple admin roles (staff vs super-admin) | v1.1 — MVP: single role `ADMIN` + audit log |
| Automated refund handling | v1.2 — MVP records REFUNDED status manually set via provider verification |
| Expiry SMS notifications automation toggle per package | v1.1 (code path exists, feature-flagged off) |

## 3. Explicit NON-GOALS (rejected)

- ❌ OTP in normal registration/reconnection flows (master prompt rule 7).
- ❌ Granting access on screenshots/browser messages/unverified claims (rule 6).
- ❌ Fake "production-ready" payment/SMS integrations (rule 5) — adapters ship in sandbox mode
  with clear `UNTESTED AGAINST LIVE CREDENTIALS` banners in docs and health panel.
- ❌ Microservices, message brokers, Kubernetes, or any unnecessary technology (§2).
- ❌ Hardware purchases beyond the single enforcement device justified by Phase 1 (§1).
- ❌ Claiming tethering can be 100% prevented (§7 transparency rule).
- ❌ Hardcoded packages/prices in the frontend (§5).
- ❌ Deleting financial history on subscription expiry (rule 8).

## 4. Success criteria for MVP acceptance

1. Full happy path works end-to-end in sandbox: connect → choose package → Daraja sandbox STK →
   backend verification → token SMS (AT sandbox) → token login → MikroTik session granted →
   expiry → session revoked.
2. Failure paths verified: failed payment, duplicate webhook, expired token, wrong token,
   rate-limited brute force, controller offline, SMS outage.
3. Revenue figures reconcile exactly against successful non-refunded payments (no double counting).
4. All six required viewport sizes pass on both UIs with no horizontal overflow/overlap.
5. `docker compose up` from a clean clone brings the whole system up using `.env.example`.
