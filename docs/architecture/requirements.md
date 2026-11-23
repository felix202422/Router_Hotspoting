# Functional & Non-Functional Requirements

**Phase:** 2 — System Planning and Design
**Status:** Approved baseline (owner approval of Phase 2: 2026-11-23)
**Date:** 2026-11-23
**Traceability:** every requirement references the master prompt section that mandates it.

---

## 1. Actors

| ID | Actor | Description |
|---|---|---|
| A1 | Guest / Customer | Unauthenticated Wi-Fi user with a phone; may become a customer |
| A2 | Registered customer | Holder of a valid access token with an active subscription |
| A3 | Administrator | Staff member operating the admin dashboard (JWT-authenticated) |
| A4 | System scheduler | Background jobs (expiry, reconciliation, retries) |
| A5 | Payment provider | M-Pesa Daraja (STK push + callbacks) |
| A6 | SMS provider | Africa's Talking (token & notification delivery) |
| A7 | Hotspot controller | MikroTik RouterOS Hotspot (or future alternative) |

## 2. Functional requirements — Customer portal (§4)

| ID | Requirement | Source |
|---|---|---|
| FR-C01 | The portal SHALL display branding, welcome message, package list, connection instructions and support contact | §4A |
| FR-C02 | Package data SHALL be fetched from the database — never hardcoded in the frontend | §5 |
| FR-C03 | A customer SHALL purchase by selecting a package, entering a valid Tanzanian phone number, reviewing the total price, and initiating payment | §4B |
| FR-C04 | The backend SHALL verify payment independently via provider API/webhook BEFORE granting anything | §4B, §20.6 |
| FR-C05 | After verified payment the system SHALL create-or-find the customer by normalized phone number (never duplicate), create the subscription, generate a secure token, store only its hash, and send the token by SMS | §4B, §6 |
| FR-C06 | The portal SHALL offer "Already have an active subscription?" → Yes: token login; No: package selection | §4C |
| FR-C07 | Token login SHALL validate token, subscription status, expiry and device binding; access only if ALL conditions pass | §4C |
| FR-C08 | The portal SHALL display current subscription info where supported: package, activation, expiry, status, device registration status | §4D |
| FR-C09 | The portal SHALL provide a device-replacement **request** form; replacement takes effect only after administrator approval | §4E |
| FR-C10 | No OTP SHALL appear in the normal registration or reconnection flow | §4C, §20.7 |
| FR-C11 | Failed token-login attempts SHALL be rate-limited per phone/IP | §6 |
| FR-C12 | The portal SHALL be reachable pre-authentication (captive-portal intercept) and work on the local network even if the internet uplink is down (browsing/packages/token login; payment/SMS degraded) | §9, D-005 |

## 3. Functional requirements — Packages (§5)

| ID | Requirement | Source |
|---|---|---|
| FR-P01 | Admin SHALL create/edit/activate/deactivate packages with: name, price (TZS, integer), duration, optional data allowance, max down/up speed, device limit, description, availability | §5 |
| FR-P02 | Example durations (1h, 3h, 12h, 24h, 7d, 30d) are seed data only, fully editable | §5 |
| FR-P03 | Subscription time SHALL start at activation and run regardless of connectivity | §5 |

## 4. Functional requirements — Customers, tokens, renewal (§6, §11)

| ID | Requirement | Source |
|---|---|---|
| FR-A01 | Phone number (E.164, TZ) is the unique customer identifier; one account per number | §6 |
| FR-A02 | Tokens SHALL be cryptographically random (≥128-bit entropy), stored only as hash, returned by SMS only, never logged | §6 |
| FR-A03 | Tokens SHALL expire and be revocable; rotation policy: new verified purchase issues a NEW token and invalidates the previous one (D-007: extension adds time to the SAME subscription → token rotates on each verified purchase) | §6 |
| FR-A04 | Renewal while active = **extend**: remaining time preserved + new package duration appended (D-007) | §6, D-007 |
| FR-A05 | Purchases find the existing customer; never duplicate | §6 |
| FR-A06 | Expiry SHALL revoke token, terminate session, remove device authorization, mark EXPIRED, remove from active view; history preserved | §11 |
| FR-A07 | Re-purchase by the same number SHALL identify the existing account and create a new subscription | §11 |

## 5. Functional requirements — Devices & sessions (§7)

| ID | Requirement | Source |
|---|---|---|
| FR-S01 | One authorized device and one concurrent session per subscription by default | §7 |
| FR-S02 | Unauthorized devices SHALL be rejected by the controller | §7 |
| FR-S03 | Admin-authorized replacement SHALL terminate the previous session and record the event | §7 |
| FR-S04 | Connection/disconnection events SHALL be recorded | §7 |
| FR-S05 | Anti-sharing: client isolation + per-user rate limits + one-session rule; tethering cannot be 100% prevented — this limitation SHALL be documented, not hidden | §7 |
| FR-S06 | MAC address SHALL be a weak hint only (randomized MACs), never sole identity | §7 |

## 6. Functional requirements — Payments (§8)

| ID | Requirement | Source |
|---|---|---|
| FR-M01 | `PaymentProvider` abstraction supporting PENDING/SUCCESS/FAILED/REFUNDED with per-provider adapters | §8 |
| FR-M02 | Backend verification mandatory: webhook (signature-verified where available) and/or status query | §8, §4B |
| FR-M03 | Idempotency: duplicate callbacks SHALL NOT double-activate subscriptions or double-count revenue | §8, §12 |
| FR-M04 | Full transaction records: reference, provider, amount (integer TZS), package, phone, status, timestamps | §8, §10 |
| FR-M05 | PINs/credentials SHALL never be stored | §8 |
| FR-M06 | v1 provider = M-Pesa Daraja, sandbox-first; no live claims until credentialed testing (D-003) | §8, D-003 |

## 7. Functional requirements — SMS (§9)

| ID | Requirement | Source |
|---|---|---|
| FR-T01 | `SmsProvider` abstraction; v1 = Africa's Talking, sandbox-first (D-004) | §9 |
| FR-T02 | Sends: access token, purchase confirmation, optional expiry notification (feature-flagged) | §9 |
| FR-T03 | Delivery status recorded where supported; transient failures retried with backoff | §9 |
| FR-T04 | Admin may resend a token (audited); credentials only in environment variables | §9 |

## 8. Functional requirements — Administration (§10)

| ID | Requirement | Source |
|---|---|---|
| FR-D01 | Overview KPIs: revenue today/week/month/year/total, active subscriptions, currently connected, total purchases, expired, failed & pending payments | §10 |
| FR-D02 | Customer management: list, search by phone, purchase history, current subscription, registered device, suspend/reactivate, approve device replacement, activity review | §10 |
| FR-D03 | Package management per FR-P01 | §10 |
| FR-D04 | Subscription management: active/expired/upcoming-expiry views, suspend, revoke token, disconnect session, history | §10 |
| FR-D05 | Payment management table with all §8 fields + filters | §10 |
| FR-D06 | Network page: connected devices, duration, IP, identifier, subscription, status, data usage — **only when a controller is connected; never fabricated** | §10 |
| FR-D07 | Disconnect/suspend unauthorized sessions | §10 |

## 9. Functional requirements — Analytics (§12)

| ID | Requirement | Source |
|---|---|---|
| FR-R01 | Daily/weekly/monthly/yearly/total revenue; successful payment counts; package performance; most-purchased; expired subs; returning customers; failed/refunded | §12 |
| FR-R02 | Reporting timezone = `Africa/Dar_es_Salaam` | §12 |
| FR-R03 | Revenue = verified SUCCESS payments, excluding refunds and duplicate callbacks | §12 |
| FR-R04 | Filters: date range, package, payment status; charts, summary cards, tables, CSV export | §12 |
| FR-R05 | Gross revenue distinguished from profit; expenses out of MVP (schema stub) | §12 |

## 10. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Responsive:** customer UI mobile-first; admin UI desktop-first; both reflow correctly at 360×800, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080; no horizontal overflow or overlap (§13) |
| NFR-02 | **Visual:** navy primary / electric-blue accent / white-grey surfaces / green-amber-red status semantics; minimal, accessible contrast, no gratuitous animation (§14) |
| NFR-03 | **Security:** JWT admin auth w/ expiry, bcrypt/argon hashing, RBAC, validation, rate limiting, parameterized queries, webhook signature verification, CORS allowlist, CSRF where applicable, audit logs, secrets via env, TLS via Nginx (§15) |
| NFR-04 | **Availability:** local portal/admin functional during uplink outage; enforcement fails safe (never silently grant); expiry enforcement continues offline via scheduler (§9, adapter design) |
| NFR-05 | **Performance:** portal API p95 < 500 ms on LAN; supports the G5TS's 64-client ceiling with headroom; analytics queries p95 < 2 s over 12 months of data |
| NFR-06 | **Data integrity:** DB-level constraints/indexes; Flyway migrations only; integer TZS; `timestamptz` everywhere; financial rows never hard-deleted (§16, §11) |
| NFR-07 | **Data retention:** only necessary customer data retained; documented deletion-request process (legal) — v1.1, policy stub in MVP (§11) |
| NFR-08 | **Observability:** structured JSON logs, no secrets/tokens in logs, audit log for admin actions, health endpoints (§15) |
| NFR-09 | **Deployability:** single `docker compose up` from clean clone with `.env.example`; automated Flyway on boot; nightly PG dumps + restore runbook (§17 Phase 7) |
| NFR-10 | **Testability:** ≥80% coverage on payment/subscription/token service layers; contract tests against OpenAPI spec (derived) |

## 11. Traceability summary

| Master prompt § | Requirements |
|---|---|
| §4 Customer portal | FR-C01…C12 |
| §5 Packages | FR-P01…P03 |
| §6 Accounts/tokens | FR-A01…A05 |
| §7 Devices/sessions | FR-S01…S06 |
| §8 Payments | FR-M01…M06 |
| §9 SMS | FR-T01…T04 |
| §10 Admin dashboard | FR-D01…D07 |
| §11 Expiry/history | FR-A06, A07, NFR-06 |
| §12 Analytics | FR-R01…R05 |
| §13–14 UI/UX | NFR-01, NFR-02 |
| §15 Security | NFR-03, NFR-08 |
| §16 Database | NFR-06 |
| §17 Deployment | NFR-09 |

**Acceptance:** all requirements above are testable; Phase 6 test matrix maps 1:1 to FR/NFR IDs.
