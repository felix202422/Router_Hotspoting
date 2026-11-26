# Known Issues

Confirmed against source code during the audit (2026-11-25). Each entry: problem → evidence →
why it matters → consequence → recommended fix → priority.

---

## KI-1 — Backend does not compile (5 errors) — **CRITICAL**
1. **Problem:** `mvn -q test` exits 1 at `maven-compiler-plugin:compile`.
2. **Evidence:** errors in `GlobalExceptionHandler.java:68-69` (missing `ResponseEntity` import;
   override signature mismatch with `ResponseEntityExceptionHandler`), `GrantRequest.java:7`
   (missing `Instant` import), `JwtService.java:81,97` (`issuedAt(Instant)`/`expiration(Instant)` —
   jjwt 0.12.6 requires `java.util.Date`, e.g. `Date.from(instant)`).
3. **Why it matters:** nothing backend-related can build, test, package or run; Phase 4 is stalled
   behind three trivial fixes.
4. **Consequence:** no API, no security layer, no database migration ever runs.
5. **Fix:** add the two imports; convert `Instant → Date` at the two jjwt call sites; re-run
   `mvn -q test`.
6. **Priority:** CRITICAL (blocker, ~15-minute fix).

## KI-2 — `MockPaymentResultEvent` has no listener — **HIGH**
1. **Problem:** the mock payment provider publishes `MockPaymentResultEvent` on a scheduler, but
   no `@EventListener`/`@TransactionalEventListener` consumes it anywhere.
2. **Evidence:** grep `MockPaymentResultEvent|@EventListener` → only `MockPaymentProvider.java:55`
   (publish) and the record itself.
3. **Why it matters:** even the dev-only end-to-end purchase flow cannot complete — the payment
   never marks SUCCESS, no subscription is activated, no token is issued.
4. **Consequence:** when controllers land, mock-mode purchases will hang at PENDING forever.
5. **Fix:** add a listener in the purchase service that calls the same idempotent core used by
   the (future) Daraja webhook handler.
6. **Priority:** HIGH (dev-flow blocker; must land with P2/P3/P4).

## KI-3 — Frontend never calls A2 (refresh) or A3 (logout) — **HIGH**
1. **Problem:** `setAuthTokens()` stores a refresh token, but nothing ever requests
   `/admin/auth/refresh`; `adminLogout()` only clears `localStorage` and never revokes
   server-side.
2. **Evidence:** grep `admin/auth/refresh|auth/logout` in `frontend/src` → zero call sites;
   `api.ts:494,509` store tokens only.
3. **Why it matters:** in live mode, admin sessions die after the 15-minute access token with no
   recovery; "logout" leaves the refresh token valid until expiry.
4. **Consequence:** admin lockouts every 15 min; revoked-on-logout guarantees unmet.
5. **Fix:** implement 401-retry-with-refresh in `services/http.ts` + server logout in
   `AuthContext.logout()` (requires backend A2/A3 first).
6. **Priority:** HIGH (ship with admin auth).

## KI-4 — Rate limiting implemented but never enforced — **HIGH**
1. **Problem:** `RateLimitService.tryAcquire()` has zero callers; `prune()` has no scheduled
   caller either (unbounded map growth once used).
2. **Evidence:** grep `tryAcquire(|prune(` → only definitions.
3. **Why it matters:** contract §4 limits (purchase 1/30 s, token login 5/min, admin login 5/min)
   are unenforceable without endpoints; token guessing/purchase spam unlimited when the API ships.
4. **Fix:** call from P2/P5/A1 controllers; schedule `prune()`.
5. **Priority:** HIGH (must accompany first controllers).

## KI-5 — A22 conflict: resend-token always 409s vs contract "re-send SAME token" — **HIGH**
1. **Problem:** `TokenService.revealForResend()` always throws 409 ("hash-only storage"), but
   contract A22 requires re-sending the **same** token, and the frontend mock does exactly that.
2. **Evidence:** `TokenService.java` (`revealForResend`); `docs/api/api-contract.md` A22;
   `api.ts` resend branch.
3. **Why it matters:** a core support flow (customer lost SMS) is impossible server-side as coded;
   contract, service and mock disagree.
4. **Fix:** decide — either (a) store an encrypted raw-token escrow for active tokens, or
   (b) rotate to a new token on resend (changes contract semantics), or (c) amend A22 to
   "issue new token, revoke old". Requires a product decision (D-027 candidate).
5. **Priority:** HIGH (functional contradiction on a documented requirement).

## KI-6 — Fake session IP `10.10.0.2` in grant flow — **HIGH**
1. **Problem:** `SubscriptionService.applyGrant()` records a placeholder IP for sessions.
2. **Evidence:** `SubscriptionService.java` (~line 146); `active_sessions.ip_address` INET.
3. **Why it matters:** FR-D06 says the network page must never fabricate data; exposing a fake IP
   as real violates honesty until MikroTik sync exists.
4. **Consequence:** admins may trust a meaningless address for device troubleshooting.
5. **Fix:** store NULL until the controller supplies the real IP, or label the column
   "unavailable" in UI when placeholder.
6. **Priority:** HIGH (honesty rule), easy fix.

## KI-7 — Dead config key `expiry-sweep-cron` — **MEDIUM**
1. **Problem:** `application.yml` defines `app.scheduler.expiry-sweep-cron` but the code reads
   `app.scheduler.expiry-sweep-ms` (fixed delay) via `@Scheduled(fixedDelayString=…)`.
2. **Evidence:** `application.yml:65` vs `ExpiryService.java:55`.
3. **Consequence:** operators editing the cron key see no effect (silent misconfiguration).
4. **Fix:** delete the dead key or switch `@Scheduled(cron=…)`.
5. **Priority:** MEDIUM.

## KI-8 — No tests anywhere; no linter — **HIGH**
1. **Problem:** zero test files; no ESLint/Checkstyle; `mvn test` can't even run (KI-1).
2. **Evidence:** glob `**/*{test,Test,spec,Spec}*` → none; `package.json` has no test/lint scripts.
3. **Consequence:** every future change is unverified; the money path (purchase/activation) is
   the most dangerous place to have no tests.
4. **Fix:** Phase 6-style test work interleaved with Phase 4: JUnit for services
   (idempotency, D-007 extension, expiry sweep), MockMvc for controllers, vitest for facade.
5. **Priority:** HIGH.

## KI-9 — Live mode returns 404/403 for every call — **CRITICAL (by absence)**
1. **Problem:** 35 live-mode paths in `api.ts`, 0 backend controllers; `SecurityConfig` default
   is `denyAll` for unlisted paths and the listed paths have no handlers.
2. **Evidence:** grep `@RestController|@GetMapping|@PostMapping` → only `@RestControllerAdvice`.
3. **Consequence:** setting `VITE_API_MODE=live` breaks the entire app.
4. **Fix:** build the API layer (P1–P7, A1–A30) — the core of Phase 4.
5. **Priority:** CRITICAL.

## KI-10 — Refresh-token rotation half-built — **HIGH**
1. **Problem:** V2 table + `JwtService` family/seq claims exist, but no issuing/rotation/
   revocation service; reuse-detection semantics (contract A2) unimplementable until then.
2. **Evidence:** `AdminRefreshTokenRepository` unused by any service; no A2/A3 endpoints.
3. **Fix:** `AdminAuthService` (issue on A1, rotate on A2 with family revoke, revoke on A3).
4. **Priority:** HIGH (see KI-3).

## KI-11 — Enum status columns lack DB CHECK constraints — **MEDIUM**
1. **Problem:** `payments.status`, `subscriptions.status`, etc. are free `VARCHAR(20)` with no
   `CHECK (status IN (…))`; JPA enums protect in-process but not external writers.
2. **Evidence:** `V1__init.sql`.
3. **Fix:** additive `V3__status_checks.sql` (additive only, per migration policy).
4. **Priority:** MEDIUM.

## KI-12 — Missing FK child-side indexes — **MEDIUM**
1. **Problem:** `sms_notifications.customer_id`, `payment_webhook_events.payment_id`,
   `device_replacement_history.subscription_id`-style lookups lack single-column indexes
   (PostgreSQL does not auto-index FKs).
2. **Evidence:** `V1__init.sql` index list.
3. **Consequence:** seq scans on tables that grow quickly (SMS/webhook logs).
4. **Fix:** additive migration with the missing indexes.
5. **Priority:** MEDIUM.

## KI-13 — No production deployment assets — **MEDIUM (Phase 7)**
No Dockerfile, docker-compose, nginx TLS config, CI workflow, or backup script exist despite
being specified in README/system-architecture §17. Priority MEDIUM (planned phase, but must not
be forgotten).

## KI-14 — Demo credentials in source — **MEDIUM**
Mock-admin email/password literal in `frontend/src/config/brand.ts` (and README). Harmless in
mock mode (live mode uses A1), but must never be copied to production config. Gate the hint
behind `import.meta.env.DEV`. See SECURITY_AUDIT SEC-4.

## KI-15 — Frontend bundle 735 kB single chunk — **LOW**
Above Vite's 500 kB warning; acceptable on LAN, but code-split admin/portal routes before
mobile-scale rollout (NFR-05).

## KI-16 — Checks that could not be completed — informational
- Database migration/validation: backend doesn't compile + PostgreSQL password unknown.
- Runtime API smoke tests: no endpoints.
- Lighthouse/a11y automated audit: no browser tooling in this environment.
- Screenshot visual regression: same limitation (computed-style verification used instead).
- Performance (NFR-05/NFR-10): requires running stack + seeded data.
