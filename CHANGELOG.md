# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
