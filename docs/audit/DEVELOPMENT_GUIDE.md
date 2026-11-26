# Development Guide

How to set up, run, and contribute to this system — verified against the repository where
possible. Known-failing steps are marked ⚠️ (see KNOWN_ISSUES).

---

## 1. Prerequisites

| Tool | Version used/expected | Notes |
|---|---|---|
| Node.js | 20.x (repo built with Node from `C:\Program Files\nodejs`) | frontend |
| JDK | 21 target (`pom.xml`); audit ran with JDK 25 at `C:\Program Files\Java\jdk-25.0.4.1` (not on PATH) | backend |
| Maven | 3.9+ (`mvn` on PATH) | backend |
| PostgreSQL | 14+ (uses `TIMESTAMPTZ`, `INET`, partial indexes, `JSONB`) | backend |
| Browser | Chromium-class for manual checks | portal/admin UI |

## 2. Repository layout

```
Router_Hotspoting/
├── .env.example            # env template (placeholders only — copy to .env, git-ignored)
├── README.md · CHANGELOG.md · LICENSE (MIT)
├── docs/
│   ├── architecture/       # requirements, use-cases, system-architecture, ui-wireframes,
│   │                        #   decision-log (D-001…D-026), implementation-plan, mvp-scope
│   ├── database/er-diagram.md
│   ├── api/api-contract.md # binding 37-endpoint contract (P1–P7, A1–A30)
│   ├── network/            # ZTE feasibility, options A/B1/B2/C, hotspot-adapter-design
│   └── audit/              # ← this audit's 13 deliverables (additive, read-only output)
├── frontend/               # React SPA (Phase 3, mock-mode complete)
└── backend/                # Spring Boot (Phase 4, ⚠️ currently does not compile)
```

## 3. Environment configuration

Copy `.env.example` → `.env` (root, git-ignored). Variables (all optional for local dev;
**never commit real values**):

| Variable | Purpose | Local default |
|---|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection | localhost:5432/hotspot, hotspot, *(empty)* |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first-run admin (only if table empty) | unset → no bootstrap |
| `JWT_SECRET` | HS256 key (≥32 bytes) | empty → **ephemeral random** (dev only) |
| `PAYMENT_PROVIDER` / `SMS_PROVIDER` / `HOTSPOT_CONTROLLER` | `mock` (dev) \| `daraja`/`africastalking`/`mikrotik` (Phase 5) | `mock` |
| `DARAJA_*`, `AT_*`, `MIKROTIK_*` | provider credentials (Phase 5) | empty |
| `CORS_ALLOWED_ORIGINS` | allow-list | localhost:5173,4173 |
| `VITE_API_MODE` *(frontend)* | unset/`mock` = in-browser backend; `live` = call Spring Boot | mock |

## 4. Frontend workflow

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173  (dev; /api proxied to :8080)
npm run build      # tsc && vite build → dist/   ✅ verified EXIT=0
npm run preview    # serve dist at http://localhost:4173
```

- All data access goes through `src/services/api.ts` (single facade, D-022). **Never import
  `http.ts` or `mock/*` from pages.**
- Mock mode is the default and fully functional; live mode requires the backend (Phase 4).
- Demo admin credentials live in `src/config/brand.ts` (mock only — never use in production).
- Responsive matrix: verify at 360×800, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080
  after any layout change (NFR-01).

## 5. Backend workflow

```powershell
cd backend
mvn compile        # ⚠️ FAILS today — 5 errors (KNOWN_ISSUES KI-1) — fix Phase 1.1 first
mvn -q test        # ⚠️ same; no tests exist yet
mvn spring-boot:run  # after compile fix + DB provisioned
```

- Schema is owned by **Flyway**: `V1__init.sql` (approved baseline — never edit) and
  `V2__admin_refresh_tokens.sql` (additive). New schema changes = new `VN__*.sql` files only,
  additive where possible.
- `spring.jpa.hibernate.ddl-auto: validate` — JPA must match the migrations exactly.
- Adapter selection is via env (`app.payment.provider`, `app.sms.provider`,
  `app.hotspot.controller`); default is `mock`, which is dev-only and labelled as such.
- First run: set `ADMIN_EMAIL` + `ADMIN_PASSWORD` **before** the first boot (bootstrap only
  runs when `administrators` is empty).

## 6. Database

```sql
-- manual provisioning (no script in repo yet):
CREATE ROLE hotspot LOGIN PASSWORD '…';
CREATE DATABASE hotspot OWNER hotspot;
```
Then run the backend so Flyway migrates. **Audit did not connect to any database** (password
unknown, and the task was read-only).

## 7. Conventions (follow the existing code)

- **Money:** integer TZS (`BIGINT`), never floats; timestamps `TIMESTAMPTZ` stored UTC,
  analytics bucketed in `Africa/Dar_es_Salaam`.
- **Errors:** throw `ApiProblem` below the web layer; `GlobalExceptionHandler` renders
  RFC 9457 problem+json with `traceId`. Never leak internals.
- **Financial rows are never hard-deleted** (NFR-06) — status transitions only.
- **Audit:** every admin mutation through `AuditService`.
- **Tokens:** raw values never stored/logged — hash (SHA-256) only; SMS bodies redacted.
- **Packages/prices:** always from DB — never hardcode in the frontend (FR-C02).
- **Decisions:** record any architectural choice in `docs/architecture/decision-log.md`
  as the next `D-0xx`.
- **Frontend style:** Tailwind tokens from the green kit (D-026): `mint` bg, `forest` panels,
  `leaf` accents, `citrus` CTAs (dark text on orange ≥4.5:1).

## 8. Quality gates before pushing

1. Frontend: `npm run build` EXIT=0; spot-check responsive matrix.
2. Backend: `mvn -q test` EXIT=0 (once Phase 1.1 is fixed; add tests as Phase 2 proceeds).
3. No secrets in the diff (`.env` must stay ignored).
4. No edits to `V1__init.sql` / `docs/api/api-contract.md` without an approved decision.
5. Update `CHANGELOG.md` + `decision-log.md` for phase pushes (session scope D-008:
   phase docs → **pause for approval before code**).

## 9. Running both tiers together

```
terminal 1: postgres (local service)
terminal 2: cd backend  && mvn spring-boot:run     # :8080
terminal 3: cd frontend && npm run dev              # :5173, VITE_API_MODE=live
```
Mock-only quick start: just terminal 3 (no backend needed).

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `mvn compile` 5 errors | KI-1 | Phase 1.1 fixes |
| Live mode 404/403 everywhere | no backend controllers (KI-9) | Phase 2 API layer |
| Admin logged out after 15 min in live mode | no A2 refresh (KI-3) | Phase 2.7 |
| Purchase stuck PENDING in mock backend | no event listener (KI-2) | Phase 1.2 |
| `JWT_SECRET` warning at startup | env not set | set it outside dev |
| Preview 4173 down | `npm run preview` not running | restart it |
