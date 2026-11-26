# Security Audit

Read-only assessment of the security posture **as implemented**. No secrets, credentials, or
configuration values are reproduced here; the only credential-like literal found in the repository
is the documented demo-admin password for the mock UI (disclosed as a finding, value omitted).

---

## 1. Security controls inventory (verified in code)

| Control | Where | Status |
|---|---|---|
| Password hashing (bcrypt) | `BootstrapAdmin.java` (`BCryptPasswordEncoder`) | ✅ implemented (bootstrap only) |
| JWT auth (HS256, 15-min access) | `JwtService.java`, `JwtAuthenticationFilter.java` | ⚙️ code present — **does not compile** (Instant/Date errors) |
| Refresh-token rotation w/ reuse detection | `V2__admin_refresh_tokens.sql`, `JwtService.parseRefresh` (family/seq claims) | ⚠️ storage + parser only; **no issuing/rotation/revocation service, no A2/A3 endpoints** |
| Default-deny authorization | `SecurityConfig.java` (`anyRequest().denyAll()`, explicit portal allow-list, `ROLE_ADMIN` on `/api/v1/admin/**`) | ✅ design correct — untestable until the app compiles |
| CORS allow-list | `SecurityConfig.corsConfigurationSource()` (`CORS_ALLOWED_ORIGINS` env, `/api/**` only) | ✅ implemented |
| CSRF | disabled (`csrf.disable()`) | ✅ documented rationale: Bearer header auth, no cookies |
| Rate limiting | `RateLimitService` (sliding window) | ⚠️ mechanism exists, **zero callers** — no endpoint enforces it |
| Audit logging | `AuditService` → `system_audit_logs` (actor/action/entity/before-after/IP) | ✅ writer implemented, used by services |
| Token hashing (portal tokens) | `TokenService` + `JwtService.sha256Hex` — raw never stored | ✅ implemented |
| Generic auth failures (FR-C11) | `TokenService.generic401()` — invalid/revoked/expired/suspended identical | ✅ implemented |
| SMS redaction (FR-T02/D-012) | `SmsService.redact()` — only `****XXXX` persisted; raw token never logged | ✅ implemented |
| Secrets via env only | `application.yml` (`${…}` placeholders), `.env.example` (placeholders), `.gitignore` blocks `.env*` | ✅ no committed secrets found (grep verification, §4) |
| Error sanitisation | `GlobalExceptionHandler` (generic 500 message), `server.error.include-message: never`, `ApiProblem` typed errors | ⚙️ present — currently fails compilation |
| Request tracing | `TraceIds` (`X-Request-Id`), allowed in CORS headers | ✅ implemented |
| Webhook signature verification | `PaymentProvider.verifySignature` — Daraja returns **false** until Phase 5 | ✅ honest fail-closed stub |
| SQL injection | JPA/parameterised queries throughout; no native string-built SQL found | ✅ (by construction) |
| Session storage | stateless JWT; `SessionCreationPolicy.STATELESS` | ✅ |
| Auth guard (frontend) | `RequireAuth` + `localStorage` token presence | ⚠️ client-side only; real enforcement must be backend (currently absent) |

## 2. Findings

### SEC-1 — Backend does not compile ⇒ no security layer is active at all
- **Evidence:** `mvn -q test` fails with 5 compilation errors (GlobalExceptionHandler ×2,
  GrantRequest ×1, JwtService ×2).
- **Why it matters:** every control in the table above exists only as source code; nothing runs.
  Live mode currently has **no server**, so there is no attack surface yet — but also no protection.
- **Priority:** **CRITICAL** (blocker for any deployment; fix is small — imports + `Date.from(instant)`).

### SEC-2 — Rate limiting not enforced anywhere
- **Evidence:** `RateLimitService.tryAcquire()`/`reset()`/`prune()` have no callers (grep).
  Contract §4 limits (purchase 1/30s, token login 5/min, admin login 5/min) are unenforceable
  without controllers.
- **Why it matters:** token guessing, purchase spam, credential stuffing would be unlimited once
  the API ships.
- **Priority:** **HIGH** — must land with the first controllers (P2/P5/A1).

### SEC-3 — Refresh-token lifecycle half-built
- **Evidence:** V2 table + `JwtService.issueRefreshToken/parseRefresh` exist; **no service or
  endpoint** issues, rotates or revokes them. Frontend stores a refresh token but never calls A2;
  `adminLogout()` never calls A3.
- **Consequence:** when A1 ships, admins either lose sessions every 15 min (no refresh) or, if a
  naive long-lived token is introduced instead, tokens survive logout/rotation — both bad.
- **Priority:** **HIGH** — implement A2/A3 with family revocation before shipping admin auth.

### SEC-4 — Demo credentials committed in frontend source
- **Evidence:** `frontend/src/config/brand.ts` contains the mock-admin email/password pair
  (used only by mock mode; value intentionally not reproduced here). It is also published in
  `README.md` for demo purposes.
- **Why it matters:** harmless while the frontend is mock-only, but must never be reachable in
  live mode (it isn't — live mode calls A1). Risk is copy-paste into production config.
- **Mitigation:** document loudly; consider gating the hint behind `import.meta.env.DEV`.
- **Priority:** **MEDIUM**.

### SEC-5 — No password management (change/reset/lockout)
- **Evidence:** no endpoint or UI for admin password change; `BootstrapAdmin` runs only when the
  table is empty; no failed-login lockout logic anywhere.
- **Consequence:** the bootstrap password, once set, can never be rotated through the product;
  no self-service recovery (recovery flow exists only for *device replacement*, admin-approved — D-006).
- **Priority:** **MEDIUM** (add A-series password-change endpoint + env-based rotation runbook).

### SEC-6 — `admin_refresh_tokens` lacks a cleanup/retention job
- **Evidence:** rows accumulate (`expires_at` set) but nothing deletes expired/revoked rows.
- **Priority:** **LOW** (schedule alongside `ExpiryService` sweep).

### SEC-7 — Single-node in-memory rate limiter
- **Evidence:** `RateLimitService` uses a `ConcurrentHashMap` — resets on restart, per-process.
- **Consequence:** acceptable for the single-node Docker deployment (system-architecture §5), but
  restarts clear counters; multi-node would double limits. Documented intent — flag only.
- **Priority:** **LOW** (Redis only if scaled beyond one node).

### SEC-8 — `JWT_SECRET` empty ⇒ ephemeral key
- **Evidence:** `JwtService` generates a random 64-byte secret at startup when env is blank and
  logs a warning; tokens die on restart.
- **Assessment:** correct dev behaviour (guarantees no committed secret); production **must** set
  `JWT_SECRET` (≥32 bytes enforced with a hard failure — good).
- **Priority:** **LOW** (ops requirement for Phase 7).

### SEC-9 — Webhook endpoint will exist before signature verification works
- **Evidence:** `SecurityConfig` permits `/api/v1/webhooks/**` unauthenticated (correct — the
  signature *is* the auth), while `DarajaAdapter.verifySignature()` returns `false` (fail-closed).
- **Assessment:** safe today (rejects everything). Risk appears in Phase 5: the webhook controller
  must verify **before** any state change and use `payment_webhook_events(provider, provider_event_id)`
  for replay protection (schema ready; logic not written).
- **Priority:** **HIGH** for Phase 5 acceptance criteria.

### SEC-10 — No TLS in-repo; localhost HTTP everywhere
- **Evidence:** no nginx/certs/compose (NFR-09/NFR-03 assign TLS to Phase 7 Nginx).
- **Priority:** **MEDIUM** (Phase 7 requirement; walled-portal LAN traffic is HTTP by nature —
  document the residual risk).

### SEC-11 — Frontend token storage in localStorage
- **Evidence:** `services/http.ts` reads `hotspot_access_token` from `localStorage`.
- **Consequence:** XSS would expose a 15-min admin token. Mitigations present: no `dangerouslySetInnerHTML`
  found, React escapes by default, short token TTL. Acceptable for v1; httpOnly cookies would be
  the upgrade path (would require revisiting the CSRF decision).
- **Priority:** **LOW–MEDIUM**.

## 3. Positive observations (things done right)

1. **Fail-closed integrations:** Daraja stub rejects all webhooks; MikroTik refuses grants;
   AT never claims delivery — no fake production behaviour (master rule 3).
2. **Hash-only token storage** with generic 401s and redacted SMS bodies — token leakage surface
   is minimal (D-012).
3. **Default-deny security config** — new endpoints are unreachable until explicitly permitted.
4. **No secrets in git:** `.gitignore` covers `.env*`; `.env.example` uses placeholders; grep over
   the repo found no API keys/tokens/passwords beyond the documented demo credential.
5. **Audit trail + traceId on every response** — support/debug without exposing internals.
6. **DB-level financial integrity** — integer TZS, no hard deletes, idempotency key unique.

## 4. Secret-exposure verification (commands run)

- Grep `(password|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]{8,}['"]` over `*.{ts,tsx,yml,java,sql,md,json}`
  → **1 match**: the mock-admin demo password in `frontend/src/config/brand.ts` (SEC-4).
- Glob for `.env`, `frontend/.env*`, `backend/.env*`, `application-*.yml` → **no files** (only
  `application.yml` with `${ENV_VAR}` placeholders).
- No private keys, `.pem`, or credential files present in the tree.

## 5. Top priorities (ranked)

| # | Issue | Priority |
|---|---|---|
| 1 | SEC-1 backend compile failure (no security runs at all) | CRITICAL |
| 2 | SEC-2 rate limiting unwired; must ship with first endpoints | HIGH |
| 3 | SEC-3 refresh/logout lifecycle (A2/A3) missing | HIGH |
| 4 | SEC-9 webhook signature + replay-guard logic (Phase 5 gate) | HIGH |
| 5 | SEC-5 admin password change/rotation | MEDIUM |
| 6 | SEC-10 TLS (Phase 7), SEC-4 demo credentials gating | MEDIUM |
