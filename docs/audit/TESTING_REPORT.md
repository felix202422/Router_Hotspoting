# Testing Report

All results below come from commands **actually executed** during this audit. Nothing is claimed
as passing unless it ran and exited successfully.

---

## 1. Test inventory

| Tier | Test framework | Test files found | Status |
|---|---|---|---|
| Backend unit tests | spring-boot-starter-test present in `pom.xml` (JUnit 5, Mockito, AssertJ) | **0** — `backend/src/test/` does not exist | ❌ none |
| Backend integration tests | — | **0** | ❌ none |
| Frontend unit tests | none configured (no vitest/jest in `package.json`) | **0** | ❌ none |
| Frontend component tests | — | **0** | ❌ none |
| End-to-end tests | none (no Playwright/Cypress) | **0** | ❌ none |
| API contract tests | — | **0** | ❌ none |

Verification command: `glob **/*{test,Test,spec,Spec}*` → **No files found** (whole repo).

**Coverage:** not measurable — there are no tests to cover. Coverage tooling is also absent
(no JaCoCo plugin in `pom.xml`, no coverage script in `package.json`).

---

## 2. Executed checks & actual results

### 2.1 Backend build/test — ❌ FAIL

Command (run in `backend/`, JDK 25 toolchain, `java.version=21` target):

```
mvn -q test        →  EXIT=1
```

**5 compilation errors** (build never reaches test execution):

| # | File | Error |
|---|---|---|
| 1 | `common/GlobalExceptionHandler.java:69` | `cannot find symbol: class ResponseEntity` |
| 2 | `common/GlobalExceptionHandler.java:68` | `method does not override or implement a method from a supertype` |
| 3 | `integration/hotspot/GrantRequest.java:7` | `cannot find symbol: class Instant` (record uses `Instant` without import) |
| 4 | `security/JwtService.java:81` | `incompatible types: java.time.Instant cannot be converted to java.util.Date` (jjwt `issuedAt`) |
| 5 | `security/JwtService.java:97` | same — `expiration(Instant)` vs `Date` |

Root causes are small (missing imports + jjwt 0.12.6 wants `java.util.Date`, e.g.
`Date.from(instant)`), but the impact is total: **the backend cannot compile, package, or start.**

### 2.2 Frontend build — ✅ PASS

Command (run in `frontend/`):

```
npm run build (tsc && vite build)   →  EXIT=0   (50.6 s)
```

- 2,215 modules transformed.
- Output: `dist/index.html` 0.85 kB, `index.css` 29.16 kB (gzip 5.79 kB),
  `index.js` 735.51 kB (gzip 205.95 kB) + sourcemap.
- Warnings only: chunk > 500 kB (known, code-splitting not configured — flagged in
  FRONTEND_DOCUMENTATION §5.7). No TypeScript errors.

### 2.3 Responsive / visual verification — ✅ PASS (manual harness, since removed)

- 12 routes × 6 viewports (360×800, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080) checked
  against the production build via a temporary iframe harness.
- Result: **zero horizontal overflow** on all combinations; zero console errors on sampled routes.
- One defect found and (outside this audit's scope, earlier in the session) fixed:
  `DataTable` used `md` breakpoint for table-vs-card, overflowing at 768 px → now `lg`.
- Screenshot-based visual checks could **not** be completed (browser tooling requires a visible
  desktop window in this environment); verification used computed styles and DOM measurements.

### 2.4 Lint / formatting — ⚠️ NOT AVAILABLE

- No ESLint/Prettier configuration exists in `frontend/` (only `tsc` acts as a checker).
- No Checkstyle/SpotBugs in `backend/pom.xml`.
- Check not completed — no lint command exists to run.

### 2.5 Static secret scan — ✅ PASS

- Regex scan for hardcoded credentials across `*.{ts,tsx,yml,java,sql,md,json}`:
  **1 match** — the documented mock-admin demo password in `frontend/src/config/brand.ts`
  (value not reproduced; see SECURITY_AUDIT SEC-4).
- Glob for `.env*` / `application-*.yml` variants: no real env files committed
  (only `.env.example` with `change-me` placeholders).

### 2.6 Test runner invocation — ❌ NOT POSSIBLE

- `mvn test` cannot run because compilation fails (§2.1) — **no test was ever executed.**
- Frontend has no test script (`package.json` scripts: `dev`, `build`, `preview` only).

---

## 3. What is untested (risk map)

| Area | Risk if untested |
|---|---|
| Purchase → webhook → activation transaction (§4.2 design) | double-activation / lost payment — money path |
| Token generation/rotation/generic-401 | token leakage or lockout bugs |
| Expiry sweep with pessimistic lock | expired users keeping access, or sweeps blocking writes |
| Rate limiter | (currently unused anyway) |
| D-007 extension math (`max(now, endsAt)`) | customers short-changed on renewal |
| Analytics TZ-day bucketing | wrong revenue reports (DST, TZ boundaries) |
| Frontend mock vs live parity | live mode silently diverging from contract |
| Responsive/a11y regression | re-introduction of the 768px overflow class of bug |

## 4. Performance concerns (analytical, not measured)

- Frontend bundle 735 kB single chunk — fine on LAN, worth splitting before mobile-heavy use.
- Analytics queries over `payments` for 12 months: indexes exist (`idx_payments_status_paid_at`),
  but NFR-10 (p95 < 2 s) is **unverified** — requires a seeded database (blocked: DB password).
- Backend p95 < 500 ms (NFR-05): unverifiable — app doesn't start.

## 5. Blocked checks (could not complete)

| Check | Blocker |
|---|---|
| Flyway migration run / `ddl-auto: validate` | backend doesn't compile; PostgreSQL password unknown |
| Runtime API smoke tests (even A1) | no controllers exist |
| Integration tests against DB | as above |
| Lighthouse / a11y audit | no browser tooling available in this environment |
| Real payment/SMS/hardware integration tests | Phase 5 not started; no credentials/hardware |

## 6. Verdict

**Testing maturity: 1/10.** The only executable quality gates are the frontend type-check/build
(passing) and manual responsive verification (passing). The backend fails its own build. Before
any production consideration, Phase 6-style test work must start **with** Phase 4 completion, not
after — the money path (purchase/activation/idempotency) is the priority for tests.
