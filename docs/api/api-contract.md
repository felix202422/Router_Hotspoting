# API Contract

**Phase:** 2 — System Planning and Design
**Status:** Approved baseline (Phase 2 approval: 2026-11-23) — Phase 4 must conform (contract tests)
**Base URL:** `https://<host>/api/v1` · JSON everywhere · Errors follow RFC 9457 problem+json
**Time format:** ISO-8601 UTC (`2026-11-23T14:05:00Z`) · Money: integer TZS · Phone: E.164

---

## 1. Conventions

**Error envelope**
```json
{ "type": "about:blank", "title": "Validation failed", "status": 400,
  "detail": "phone must be a valid Tanzanian number", "traceId": "…" }
```
**Standard statuses:** 400 validation · 401 unauthenticated · 403 forbidden · 404 not found ·
409 conflict/duplicate · 429 rate-limited (with `Retry-After`) · 422 business-rule violation.
**Admin auth:** `Authorization: Bearer <JWT>` (15 min access, refresh token rotation 30 days).

## 2. Public customer-portal endpoints (no auth)

| # | Method & path | Purpose | Key rules |
|---|---|---|---|
| P1 | `GET /packages` | Active packages | From DB only (FR-C02); cacheable 30 s |
| P2 | `POST /purchases` | Initiate purchase | Rate-limited per phone (1/30 s) |
| P3 | `GET /purchases/{purchaseId}` | Poll purchase status | Opaque purchase ref, no PII leak |
| P4 | `POST /webhooks/payments/daraja` | Provider callback | Signature-verified, idempotent (FR-M02/M03) |
| P5 | `POST /auth/token-login` | Reconnect with token | Rate-limited (5/min per IP+phone), generic errors (FR-C11) |
| P6 | `GET /subscriptions/current` | Subscription info | Requires valid token header (see below) |
| P7 | `POST /device-replacement-requests` | Request device change | Creates PENDING request (FR-C09) |

### P2 — `POST /purchases`
```jsonc
// Request
{ "phone": "+255712345678", "packageId": 3 }
// 201 Response
{ "purchaseId": "pur_8f3a…", "status": "PENDING",
  "package": { "name": "24 Hours", "priceTzs": 2000, "durationSeconds": 86400 },
  "phone": "+255712345678",
  "paymentInstructions": "Approve the M-Pesa prompt on your phone" }
// 422 example: { …, "title": "Package unavailable" }  (inactive package)
```

### P3 — `GET /purchases/{purchaseId}`
```jsonc
{ "purchaseId": "pur_8f3a…", "status": "SUCCESS",   // PENDING | SUCCESS | FAILED
  "failureReason": null,
  "subscription": { "id": 42, "package": "24 Hours",
                    "startsAt": "2026-11-23T14:07:00Z",
                    "endsAt":   "2026-11-24T14:07:00Z", "status": "ACTIVE" } }
```
> Token is **never** in any HTTP response — SMS only (FR-A02).

### P4 — `POST /webhooks/payments/daraja`
Provider-signed callback. Verified → raw payload stored in `payment_webhook_events` →
idempotent processing → 200 `{ "received": true }`. Invalid signature → 401, logged, no state
change. Replay (duplicate `provider_event_id`) → 200 with `IGNORED`.

### P5 — `POST /auth/token-login`
```jsonc
// Request
{ "token": "9f2c…-…", "deviceHint": "a1b2c3d4e5f6" }
// 200
{ "subscription": { "id": 42, "package": "24 Hours", "status": "ACTIVE",
                    "startsAt": "…", "endsAt": "…" },
  "session": { "state": "CONNECTED", "boundAt": "…" } }
// 401 { "title": "Invalid or expired access token" }   ← same for all failure reasons
// 429 { "title": "Too many attempts", "retryAfter": 47 }
// 409 device mismatch → { "title": "Different device detected",
//                          "detail": "Request a device replacement from support" }
```

### P6 — `GET /subscriptions/current`
Header: `X-Access-Token: <token>` → subscription + device registration status (FR-C08).
401 if token invalid/revoked/expired.

### P7 — `POST /device-replacement-requests`
```jsonc
// Request { "token": "…", "reason": "Broke my phone, new device", "newDeviceHint": "…" }
// 201 { "requestId": 7, "status": "PENDING",
//       "message": "Your request is pending administrator approval" }
```

## 3. Admin endpoints (`/admin/**`, JWT + role ADMIN)

### Auth
| # | Method & path | Purpose |
|---|---|---|
| A1 | `POST /admin/auth/login` | `{email, password}` → `{accessToken, refreshToken, expiresIn}` + profile |
| A2 | `POST /admin/auth/refresh` | Rotate refresh token (reuse → revoke family) |
| A3 | `POST /admin/auth/logout` | Revoke refresh token |
| A4 | `GET /admin/auth/me` | Current profile |

### Dashboard & stats
| # | Method & path | Purpose |
|---|---|---|
| A5 | `GET /admin/stats/overview?range=today\|week\|month\|year` | KPI cards (FR-D01): `revenueToday/Week/Month/Year/Total`, `activeSubscriptions`, `connectedCustomers`, `totalPurchases`, `expiredSubscriptions`, `failedPayments`, `pendingPayments` |

### Customers & devices
| # | Method & path | Purpose |
|---|---|---|
| A6 | `GET /admin/customers?search=&page=&size=` | Search by phone (FR-D02) |
| A7 | `GET /admin/customers/{id}` | Profile + current subscription + device + purchase history |
| A8 | `POST /admin/customers/{id}/suspend` \| `/reactivate` | Suspends customer AND revokes grant; audited |
| A9 | `GET /admin/customers/{id}/device` | Registered device view |
| A10 | `GET /admin/device-replacements?status=PENDING` | Replacement queue |
| A11 | `POST /admin/device-replacements/{id}/approve` \| `/reject` | UC09; approve disconnects old session, re-binds device, writes history (FR-S03) |
| A12 | `POST /admin/customers/{id}/disconnect` | Force session disconnect (FR-D07) |

### Packages
| # | Method & path | Purpose |
|---|---|---|
| A13 | `GET /admin/packages?status=` | List incl. inactive |
| A14 | `POST /admin/packages` | Create (FR-P01) |
| A15 | `PUT /admin/packages/{id}` | Edit price/duration/limits |
| A16 | `POST /admin/packages/{id}/activate` \| `/deactivate` | Toggle availability |

### Subscriptions
| # | Method & path | Purpose |
|---|---|---|
| A17 | `GET /admin/subscriptions?status=ACTIVE\|EXPIRED\|SUSPENDED&expiringWithin=&search=` | Views incl. upcoming expirations (FR-D04) |
| A18 | `GET /admin/subscriptions/{id}` | Detail + history |
| A19 | `POST /admin/subscriptions/{id}/suspend` \| `/resume` | Reversible; revokes/restores grant |
| A20 | `POST /admin/subscriptions/{id}/revoke` | Revoke token + grant permanently |

### Payments
| # | Method & path | Purpose |
|---|---|---|
| A21 | `GET /admin/payments?from=&to=&status=&packageId=&phone=&page=` | Table + filters (FR-D05) |
| A22 | `POST /admin/payments/{id}/resend-token` | Re-send SAME valid token, audited (FR-T04); 409 if token revoked |

### Analytics
| # | Method & path | Purpose |
|---|---|---|
| A23 | `GET /admin/analytics/revenue?from=&to=&packageId=&status=` | Time series (day/week/month buckets in `Africa/Dar_es_Salaam`) + totals (FR-R01–R03) |
| A24 | `GET /admin/analytics/packages?from=&to=` | Package performance, most-purchased |
| A25 | `GET /admin/analytics/customers?from=&to=` | New vs returning customers, expired counts |
| A26 | `GET /admin/analytics/export.csv?from=&to=&packageId=&status=` | CSV of payments (FR-R04); same filters as A21/A23 |

```jsonc
// A23 sample 200
{ "currency": "TZS",
  "buckets": [ { "period": "2026-11-23", "revenueTzs": 48000, "payments": 24 } ],
  "totals":  { "revenueTzs": 48000, "payments": 24,
               "grossTzs": 48000, "refundedTzs": 0, "profitTzs": null } }
```

### Network (controller-backed, FR-D06 — never fabricated)
| # | Method & path | Purpose |
|---|---|---|
| A27 | `GET /admin/network/health` | `{enforcementActive, controller: "MIKROTIK", reachable, lastSyncAt, drift}` |
| A28 | `GET /admin/network/sessions` | Live sessions: IP, device, subscription, duration, bytes; `[]` when controller offline with `reachable:false` |
| A29 | `POST /admin/network/sessions/{grantRef}/disconnect` | Disconnect (FR-D07) |

### Audit
| # | Method & path | Purpose |
|---|---|---|
| A30 | `GET /admin/audit-logs?actor=&action=&entityType=&from=&to=` | Read-only (FR-D… §15) |

## 4. Rate limits (summary)

| Endpoint class | Limit |
|---|---|
| `POST /purchases` per phone | 1 / 30 s, 10 / hour |
| `POST /auth/token-login` per IP+phone | 5 / min, then exponential backoff |
| `POST /admin/auth/login` per IP | 5 / min |
| Webhooks | 100 / min per IP allowlist |

## 5. Versioning & evolution

- Path versioning `/api/v1`; additive changes only within v1; breaking changes → `/v2`.
- Contract tests (Phase 6) assert controllers match this document (derived OpenAPI in Phase 4).
- Webhook payloads follow provider schemas; our internal event envelope is provider-agnostic.
