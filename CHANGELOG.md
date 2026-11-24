# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] — 2026-11-24

### Added — Phase 3: Frontend Development (implemented, pending approval)
- Vite + React 18 + TypeScript (strict) + Tailwind build config with pinned dependencies,
  `@` path alias, navy/electric design tokens, 44px tap targets, no global horizontal overflow.
- `frontend/src/config/brand.ts` — single source of truth for business identity (placeholder
  brand until owner supplies name/logo); packages are NEVER hardcoded in the frontend.
- `frontend/src/types` — full mirror of the Phase 2 API contract, incl. `ApiError` (RFC 9457).
- `frontend/src/services/api.ts` — single API facade with mock/live modes switched by
  `VITE_API_MODE`; mock backend simulates idempotent purchases, D-007 extension rule,
  token rotation, rate limiting, TZ-day (Africa/Dar_es_Salaam) analytics, device binding.
- Shared component library (16 components): Button, Card, Badge/StatusBadge, StatCard,
  Input/Field/Textarea/Select, Modal, Drawer, ConfirmDialog, responsive DataTable
  (table ≥768px, stacked cards below — never horizontal scroll), Pagination, Stepper,
  Toast, Spinner, EmptyState, PageHeader.
- Auth: `AuthProvider` + `RequireAuth` route guard (admin), token storage in localStorage.
- Layouts: `PortalLayout` (mobile-first) and `AdminLayout` (≥1024px sidebar, <1024px
  hamburger drawer).
- Customer portal pages: Landing, Purchase (3-step + payment polling), Token login,
  Subscription status, Device replacement, dev-only Mock SMS inbox.
- Admin pages: Login, Overview (KPIs + 30-day revenue chart), Customers, Packages,
  Subscriptions, Payments, Network (controller-backed sessions), Analytics (revenue/package/
  customer + CSV export), Audit log.

### Fixed
- Mock admin login now persists the access token (previously only the live branch did),
  so a page reload keeps the administrator signed in instead of bouncing to the login page.

### Verified
- `npm run build` — tsc clean + Vite production build (735 kB / 206 kB gzip; chunk-size
  warning only).
- Browser smoke test: portal landing + admin login → Overview render with zero console errors.
- Responsive harness: 15 portal checks (5 routes × 360/768/1920) and 16 admin checks
  (8 routes × 360/1366) — all `overflowX = 0`, all pages render expected headings.

## [0.1.0] — 2026-11-23

### Added
- Phase 1 documentation set:
  - ZTE G5TS hardware feasibility report with on-site verification checklist (T1–T9).
  - Network architecture options (A soft-gate, B1 MikroTik, B2 Pi, C ZTE-bridge) with
    comparison and recommendation.
  - Hotspot controller adapter design (`HotspotController` interface: MikroTik/Mock/Null).
  - MVP scope and explicit non-goals.
  - Decision log (D-001 … D-017) capturing all owner decisions.
  - Implementation plan for Phases 2–7 with API contract outline, ER draft and risk register.
- Project README, license (MIT, pending confirmation), gitignore.

### Notes
- No application code written yet — paused for owner approval per agreed session scope
  (decision D-008).

## [0.2.0] — 2026-11-23

### Added — Phase 2: System Planning and Design (approved)
- `docs/architecture/requirements.md` — FR/NFR baseline with full traceability to the master
  prompt (FR-C/P/A/S/M/T/D/R + NFR-01…10).
- `docs/architecture/use-cases.md` — 18 use cases, sequence narratives (purchase, token login,
  expiry, replacement, reconciliation) and testable business-rule invariants.
- `docs/architecture/system-architecture.md` — component + deployment diagrams (Option B1),
  modular-monolith backend layout, security architecture, environment profiles.
- `docs/database/er-diagram.md` — complete 13-table schema with constraints, indexes,
  idempotency and concurrency rules (basis for Flyway `V1__init.sql`).
- `docs/api/api-contract.md` — full REST contract: 7 public + 30 admin endpoints, error
  envelope, rate limits, versioning.
- `docs/architecture/ui-wireframes.md` — portal (mobile-first) and admin (desktop-first)
  wireframes with responsive behaviour per required viewport.

### Changed
- Decision log: D-018 (Phase 2 approved), D-019 (MIT license confirmed), D-020 (Option B1
  committed as build target), D-021 (Phase 2 baselines binding for Phases 3–4).
- README phase status: Phase 2 complete; doc index expanded.
