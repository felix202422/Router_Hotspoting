# Use Cases

**Phase:** 2 — System Planning and Design
**Status:** Approved baseline (Phase 2 approval: 2026-11-23)
**Date:** 2026-11-23

---

## 1. Use-case diagram

```mermaid
usecaseDiagram
    actor Customer as "Guest/Customer (A1/A2)"
    actor Admin as "Administrator (A3)"
    actor System as "Scheduler (A4)"
    actor Daraja as "M-Pesa Daraja (A5)"
    actor AT as "Africa's Talking (A6)"
    actor Controller as "Hotspot Controller (A7)"

    package "Customer Portal" {
        UC01 "Browse packages" as UC01
        UC02 "Purchase package" as UC02
        UC03 "Token login (reconnect)" as UC03
        UC04 "View subscription info" as UC04
        UC05 "Request device replacement" as UC05
    }
    package "Admin Dashboard" {
        UC06 "Login (JWT)" as UC06
        UC07 "Manage packages" as UC07
        UC08 "Manage customers & devices" as UC08
        UC09 "Approve device replacement" as UC09
        UC10 "Manage subscriptions" as UC10
        UC11 "Review payments / resend token" as UC11
        UC12 "View network sessions" as UC12
        UC13 "Analytics & CSV export" as UC13
        UC14 "View audit logs" as UC14
    }
    package "System" {
        UC15 "Expire subscriptions" as UC15
        UC16 "Reconcile controller state" as UC16
        UC17 "Process verified payment" as UC17
        UC18 "Deliver SMS" as UC18
    }

    Customer --> UC01
    Customer --> UC02
    Customer --> UC03
    Customer --> UC04
    Customer --> UC05
    Admin --> UC06
    Admin --> UC07
    Admin --> UC08
    Admin --> UC09
    Admin --> UC10
    Admin --> UC11
    Admin --> UC12
    Admin --> UC13
    Admin --> UC14
    System --> UC15
    System --> UC16
    UC02 --> UC17
    UC17 --> Daraja
    UC17 --> UC18
    UC18 --> AT
    UC17 --> Controller
    UC15 --> Controller
    UC03 --> Controller
    UC16 --> Controller
```

## 2. Primary narratives

### UC02 — Purchase package (happy path)

- **Actor:** Guest (A1)
- **Preconditions:** connected to hotspot Wi-Fi; package active in DB; payment uplink available.
- **Flow:**
  1. Customer selects package (FR-C02) and enters TZ phone number (FR-C03).
  2. Portal shows summary: package, duration, price (TZS), phone.
  3. Backend creates PENDING payment + initiates Daraja STK push (FR-M01).
  4. Customer approves the STK prompt on their handset.
  5. Daraja callback → backend verifies signature/origin (FR-M02) → idempotent processing (FR-M03).
  6. SUCCESS: find-or-create customer by phone (FR-A01/A05) → extend-or-create subscription (FR-A04) → generate token, store hash (FR-A02) → grant controller access (FR-S01) → send SMS (FR-T02).
  7. Portal shows success; token arrives by SMS.
- **Alternative flows:**
  - *FAILED/timeout:* payment marked FAILED; no customer token; retry offered.
  - *Duplicate callback:* ignored (idempotency key) — no second subscription/token.
  - *SMS outage:* payment still SUCCESS; token retained (hashed) for admin-resent; portal offers "contact support" state (honest degraded messaging).
  - *Controller unreachable:* subscription ACTIVE, flagged `ENFORCEMENT_PENDING`; never falsely claim connected.
- **Postconditions:** payment row SUCCESS, subscription ACTIVE, exactly one valid token, exactly one controller grant, audit entry.
- **Exceptions:** customer with ACTIVE subscription purchases again → extend: remaining time + new duration (FR-A04, D-007); previous token rotated (FR-A03).

### UC03 — Token login (reconnect)

- **Actor:** Registered customer (A2)
- **Flow:** enters token → rate limit check (FR-C11) → hash lookup → token valid? → subscription ACTIVE and not expired? → device binding: first use binds presenting device; later use must match session device policy (FR-S01/S06) → controller grant refreshed → session started, event recorded (FR-S04).
- **Failure paths:** invalid/expired/revoked token → generic error (no token oracle); rate-limited → 429 with retry-after; expired subscription → "expired, please purchase" path; device mismatch → "contact support to transfer device" (ties to UC05).
- **Postconditions:** session connected, or precise rejection with reason; every attempt audited without logging the token.

### UC09 — Approve device replacement

- **Actor:** Admin (A3); requester = customer via UC05
- **Flow:** customer submits request (old device lost/new phone) → request PENDING → admin reviews identity evidence (call/in-person per D-006) → approves → old session disconnected, device authorization re-bound, `device_replacement_history` row written (FR-S03) → customer re-logs with token on new device → audit log entry.
- **Reject path:** request REJECTED with reason; no device change.

### UC15 — Expire subscriptions (scheduled)

- **Actor:** Scheduler (A4), runs every minute
- **Flow:** find subscriptions where `ends_at <= now()` and status = ACTIVE → in one transaction: status=EXPIRED → revoke token → revoke controller grant (terminate session) → remove device authorization → write audit + events (FR-A06).
- **Postconditions:** financial history untouched (NFR-06); expired view updated; controller state reconciled (UC16 catches missed revokes).

### UC16 — Reconcile controller state

- **Actor:** Scheduler (A4), hourly
- **Flow:** compare DB ACTIVE grants ↔ controller users/sessions → remove orphan controller users (deleted/expired subs still online) → flag drift on admin health panel → retry failed revokes.

### UC13 — Analytics & CSV export

- **Actor:** Admin
- **Flow:** choose date range (Africa/Dar_es_Salaam day boundaries, FR-R02), optional package/status filters → summary cards + charts (FR-R01/R04) computed from SUCCESS payments excluding refunds/duplicates (FR-R03) → table view → CSV export of the same filtered dataset.

## 3. Secondary use cases (summary)

| UC | Actor | Trigger | Key rule |
|---|---|---|---|
| UC01 | Guest | Portal open | Packages from DB (FR-C02) |
| UC04 | Customer | Logged in / token valid | Show only own data (FR-C08) |
| UC05 | Customer | New device | Request only — no auto-takeover (§4E) |
| UC06 | Admin | Login page | JWT + bcrypt, refresh, expiry (NFR-03) |
| UC07 | Admin | Packages page | Validation: price > 0, duration > 0 (FR-P01) |
| UC08 | Admin | Customers page | Suspend = revoke grant + keep history |
| UC10 | Admin | Subscriptions page | Revoke = token + controller; suspend reversible |
| UC11 | Admin | Payments page | Resend token = new SMS of SAME valid token, audited (FR-T04) |
| UC12 | Admin | Network page | Only live controller data; graceful empty state (FR-D06) |
| UC14 | Admin | Audit page | Read-only, filterable |

## 4. Business-rule invariants (asserted by tests)

1. No grant before verified payment (FR-C04) — enforced by flow ordering in UC02.
2. Exactly one valid token per active subscription at any time (FR-A03).
3. One concurrent session per subscription (FR-S01).
4. Revenue = Σ(SUCCESS payments) − refunds, per TZ day (FR-R03/R02).
5. Subscription clock runs from activation, independent of connectivity (FR-P03).
6. Expiration removes access, never rows of financial history (FR-A06).
