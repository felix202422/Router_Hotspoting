# API Documentation

**Ground truth:** `docs/api/api-contract.md` (Phase 2 baseline, D-021) defines **37 endpoints**
(P1–P7 public portal, A1–A30 admin). This audit verifies each against the actual code.

> ### ⚠️ Headline finding
> **The backend implements ZERO HTTP endpoints.** A grep for
> `@RestController|@GetMapping|@PostMapping|@RequestMapping` across `backend/src` returns exactly
> one match: `@RestControllerAdvice` on `GlobalExceptionHandler` (an error handler, not a route).
> Additionally **the backend does not compile** (5 errors, see TESTING_REPORT), so it cannot even
> start. Every endpoint below is therefore **MISSING (not implemented)** — what *does* exist is
> the client side (frontend live mode) and the security rules that will front it.

---

## 1. Status legend

| Status | Meaning |
|---|---|
| MISSING | No server-side implementation exists |
| CLIENT-READY | Frontend calls this path in live mode; shape matches contract |
| STUBBED | Adapter/handler code exists but deliberately fails (Phase 5) |

## 2. Public portal endpoints (contract §2, prefix `/api/v1`)

| ID | Method & path | Purpose | Auth | Req → Res (contract) | Frontend caller | Server status |
|---|---|---|---|---|---|---|
| P1 | `GET /packages` | Active packages (DB only) | public | – → `Package[]` | `listPackages()` | **MISSING** (client-ready) |
| P2 | `POST /purchases` | Initiate purchase; rate-limited 1/30s per phone | public | `{packageId, phoneE164, idempotencyKey}` → `{purchaseId, status}` | `createPurchase()` | **MISSING** (client-ready) |
| P3 | `GET /purchases/{purchaseId}` | Poll status; opaque ref, no PII | public | – → `{status, tokenHint?}` | `getPurchase()` | **MISSING** (client-ready) |
| P4 | `POST /webhooks/payments/daraja` | Provider callback; signature + replay guard | public (signature) | raw body + signature → 204 | — (server-side) | **MISSING**; `DarajaAdapter.verifySignature()` returns false (rejects all) — **STUBBED** |
| P5 | `POST /auth/token-login` | Reconnect with token; 5/min/IP+phone; generic errors | public | `{token, deviceHint}` → session | `tokenLogin()` | **MISSING** (client-ready; service logic exists in `TokenService`) |
| P6 | `GET /subscriptions/current` | Current subscription info | `X-Access-Token` header | – → `SubscriptionInfo` | `getSubscription()` | **MISSING** (client-ready) |
| P7 | `POST /device-replacement-requests` | Request device change → PENDING | public | `{reason, …}` → `{id, status}` | `createDeviceReplacement()` | **MISSING** (client-ready) |

## 3. Admin endpoints (contract §5, `/api/v1/admin/**`, ROLE_ADMIN)

Security rules **exist** in `SecurityConfig` (login/refresh/logout public, rest requires
`ROLE_ADMIN`, default deny) — but no handlers exist behind them.

| ID | Method & path | Purpose | Frontend caller | Server status |
|---|---|---|---|---|
| A1 | `POST /admin/auth/login` | email+password → access+refresh+profile | `adminLogin()` | **MISSING** (client-ready; `JwtService`/`BootstrapAdmin` exist) |
| A2 | `POST /admin/auth/refresh` | rotate refresh token, reuse → revoke family | **never called by frontend** | **MISSING**; V2 table ready, no service |
| A3 | `POST /admin/auth/logout` | revoke refresh token | **never called** (`adminLogout()` only clears localStorage) | **MISSING** |
| A4 | `GET /admin/auth/me` | current profile | not called (profile from login response) | **MISSING** |
| A5 | `GET /admin/stats/overview` | KPI cards (FR-D01) | `getOverview()` | **MISSING** (client-ready) |
| A6 | `GET /admin/customers?search=&page=&size=` | phone search | `listCustomers()` | **MISSING** (client-ready) |
| A7 | `GET /admin/customers/{id}` | detail + history | `getCustomer()` | **MISSING** (client-ready) |
| A8 | `POST /admin/customers/{id}/suspend|reactivate` | suspend + revoke grant | `setCustomerStatus()` | **MISSING** (client-ready) |
| A9 | `GET /admin/customers/{id}/device` | registered device | not called (bundled in A7) | **MISSING** |
| A10 | `GET /admin/device-replacements?status=` | replacement queue | `listReplacements()` | **MISSING** (client-ready) |
| A11 | `POST /admin/device-replacements/{id}/approve|reject` | UC09 decision | `reviewReplacement()` | **MISSING** (client-ready) |
| A12 | `POST /admin/customers/{id}/disconnect` | force disconnect | `disconnectCustomer()` | **MISSING** (client-ready) |
| A13 | `GET /admin/packages?status=` | list incl. inactive | `listAdminPackages()` | **MISSING** (client-ready) |
| A14 | `POST /admin/packages` | create | `createPackage()` | **MISSING** (client-ready) |
| A15 | `PUT /admin/packages/{id}` | edit | `updatePackage()` | **MISSING** (client-ready) |
| A16 | `POST /admin/packages/{id}/activate|deactivate` | toggle | `setPackageStatus()` | **MISSING** (client-ready) |
| A17 | `GET /admin/subscriptions?…` | filtered views | `listSubscriptions()` | **MISSING** (client-ready) |
| A18 | `GET /admin/subscriptions/{id}` | detail | not called | **MISSING** |
| A19 | `POST /admin/subscriptions/{id}/suspend|resume` | reversible | `subscriptionAction()` | **MISSING** (client-ready; `SubscriptionService.suspend/resume` exist) |
| A20 | `POST /admin/subscriptions/{id}/revoke` | permanent | `subscriptionAction()` | **MISSING** (client-ready; `SubscriptionService.revoke` exists) |
| A21 | `GET /admin/payments?…` | filtered table | `listPayments()` | **MISSING** (client-ready) |
| A22 | `POST /admin/payments/{id}/resend-token` | re-send SAME token, audited, 409 if revoked | `resendToken()` | **MISSING**; `TokenService.revealForResend()` **always throws 409** — service contradicts contract (see KNOWN_ISSUES) |
| A23 | `GET /admin/analytics/revenue` | TZ-day buckets + totals | `getRevenueAnalytics()` | **MISSING** (client-ready) |
| A24 | `GET /admin/analytics/packages` | package performance | `getPackageAnalytics()` | **MISSING** (client-ready) |
| A25 | `GET /admin/analytics/customers` | new vs returning | `getCustomerAnalytics()` | **MISSING** (client-ready) |
| A26 | `GET /admin/analytics/export.csv` | CSV export | `exportPaymentsCsv()` | **MISSING** (client-ready) |
| A27 | `GET /admin/network/health` | enforcement/controller health | `getNetworkHealth()` | **MISSING** (client-ready; `HotspotController.health()` exists) |
| A28 | `GET /admin/network/sessions` | live sessions | `listNetworkSessions()` | **MISSING** (client-ready) |
| A29 | `POST /admin/network/sessions/{grantRef}/disconnect` | disconnect | `disconnectSession()` | **MISSING** (client-ready; `HotspotController.disconnect` exists) |
| A30 | `GET /admin/audit-logs?…` | audit trail | `listAuditLogs()` | **MISSING** (client-ready; `AuditService` writes rows) |

**Coverage summary:** 0/37 implemented · 30 have a matching frontend live-mode caller (client-ready)
· 7 have no client caller (P4 server-side, A2–A4, A9, A18) — of which **A2/A3 are a live-mode gap**
(see §5).

## 4. Error model, rate limits, conventions (contract §1/§4)

- Errors: RFC 9457 `application/problem+json` with `type/title/status/detail/traceId` (+`retryAfter`).
  **Implemented** in `GlobalExceptionHandler` + `ApiProblem` + `ProblemDetailHandlers`
  — but never exercised (no endpoints, and the class currently fails compilation).
- Rate limits (contract §4): purchase 1/30s per phone; token login 5/min per IP+phone; admin login
  5/min per IP; resend 1/60s. **`RateLimitService` implements the mechanism but has zero callers.**
- Auth: `Authorization: Bearer <accessToken>` (admin) · `X-Access-Token` (portal P6) ·
  CORS allow-list · `X-Request-Id` echo (`TraceIds`).
- Pagination envelope `Paged<T>`: `{items, page, size, total}` — mirrored exactly in
  `frontend/src/types/index.ts` (30 interfaces/types).

## 5. Integration endpoints & external APIs

| Integration | Direction | Implementation status |
|---|---|---|
| M-Pesa Daraja (STK push + callback) | outbound init, inbound `POST /webhooks/payments/daraja` | **STUBBED** — `DarajaAdapter.initiate()` throws; signature verify returns false. Sandbox credentials pending from owner (decision D-003, open item in decision-log) |
| Africa's Talking SMS | outbound | **STUBBED** — `AfricasTalkingAdapter` logs error, returns failure, never claims delivery (D-004) |
| MikroTik RouterOS API (TCP 8728/8729) | outbound | **STUBBED** — `MikroTikAdapter` refuses grants (D-009/D-020; Phase 5 + on-site hardware) |
| OpenAPI (`/v3/api-docs`, `/swagger-ui.html`) | derived | springdoc dependency present + `SecurityConfig` permits it, but with no annotated controllers it would serve an **empty spec** |

**Working vs placeholder:** the only *working* external-facing behaviours are the **mock adapters**
(dev-only, explicitly labelled not-production) and the frontend's in-browser mock. No real
integration is functional, and none pretends to be — which is the honest state required by the
master prompt.

## 6. Frontend ↔ contract mismatches found (for Phase 4 completion)

1. **A2 refresh never called** — `AuthContext` stores a refresh token but nothing uses it; after
   the 15-minute access token expires, live mode would 401 with no recovery path.
2. **A3 logout never called** — refresh token stays valid server-side after "logout" (until expiry)
   if/when the backend implements family revocation.
3. **A22 resend-token** — frontend mock resends the same token; backend service always 409s.
   Contract requires re-sending the SAME token (only hash stored) → backend needs either a stored
   raw-token escrow or a contract amendment; current code and contract disagree.
4. Live paths count (35) vs contract (37): P4/A2/A3/A4/A9/A18 have no client caller — expected for
   server-side/optional endpoints, except A2/A3 above.
