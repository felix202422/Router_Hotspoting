# Paid Wi-Fi Hotspot Management System

A professional, secure, responsive **paid Wi-Fi hotspot management system** for a small internet
hotspot business in Tanzania: customers connect, purchase an internet package via mobile money,
receive an access token by SMS, and are granted controlled internet access through a hotspot
controller. Administrators manage packages, customers, payments, subscriptions, sessions and
revenue from a full dashboard.

## Repository status

> **Phases 1 and 2 COMPLETE and approved by the owner. No application code yet, by design —
> Phase 3 (frontend) begins after this approval gate.** The on-site ZTE checklist
> (`docs/network/zte-g5ts-feasibility.md` §6) remains open but only gates Phase 5 hardware
> configuration (decision D-020).

| Phase | Status |
|---|---|
| 1 — Requirements & hardware feasibility | ✅ Complete & approved |
| 2 — System planning & design | ✅ Complete & approved (2026-11-23) |
| 3 — Frontend development | ⏳ Not started |
| 4 — Backend development | ⏳ Not started |
| 5 — Integrations (payment / SMS / hotspot) | ⏳ Not started |
| 6 — Testing | ⏳ Not started |
| 7 — Deployment | ⏳ Not started |

## Key documents

| Document | Purpose |
|---|---|
| [`docs/architecture/requirements.md`](docs/architecture/requirements.md) | Functional & non-functional requirements with master-prompt traceability |
| [`docs/architecture/use-cases.md`](docs/architecture/use-cases.md) | Use-case diagram + narratives + business-rule invariants |
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | Component/deployment architecture, backend structure, security architecture |
| [`docs/database/er-diagram.md`](docs/database/er-diagram.md) | Full relational schema (source for Flyway `V1__init.sql`) |
| [`docs/api/api-contract.md`](docs/api/api-contract.md) | Complete REST contract (portal + admin) — binding for Phase 4 |
| [`docs/architecture/ui-wireframes.md`](docs/architecture/ui-wireframes.md) | Portal & admin wireframes + responsive behaviour — binding for Phase 3 |
| [`docs/network/zte-g5ts-feasibility.md`](docs/network/zte-g5ts-feasibility.md) | What the ZTE G5TS can/cannot do + on-site verification checklist |
| [`docs/network/network-architecture-options.md`](docs/network/network-architecture-options.md) | Architecture options A/B1/B2/C, comparison, recommendation (B1) |
| [`docs/network/hotspot-adapter-design.md`](docs/network/hotspot-adapter-design.md) | Modular controller integration layer |
| [`docs/architecture/mvp-scope.md`](docs/architecture/mvp-scope.md) | MVP cut line and explicit non-goals |
| [`docs/architecture/decision-log.md`](docs/architecture/decision-log.md) | Every architectural decision and its rationale |
| [`docs/architecture/implementation-plan.md`](docs/architecture/implementation-plan.md) | Phases 2–7 plan, API outline, ER draft, risk register |

## Planned technology stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Lucide icons, Recharts
- **Backend:** Java 21, Spring Boot, Spring Security, JWT (admin auth), REST
- **Database:** PostgreSQL with Flyway migrations
- **Infra:** Docker Compose, Nginx reverse proxy, environment-based config, structured logging
- **Network:** ZTE G5TS (internet uplink) + MikroTik RouterOS Hotspot (enforcement, recommended)
- **Integrations:** M-Pesa Daraja (payments), Africa's Talking (SMS) — both sandbox-first

## Target repository structure

```text
paid-wifi-hotspot/
├── frontend/            # React + TS customer portal & admin dashboard
├── backend/             # Spring Boot API
├── infrastructure/      # docker/ nginx/
├── docs/                # architecture/ database/ api/ network/ deployment/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Development rules (binding)

1. Never grant internet access before **verified** payment.
2. No OTP in the normal customer registration or reconnection flow.
3. No invented or fake payment/SMS integrations presented as production-ready.
4. Financial history is preserved when subscriptions expire.
5. Packages and prices live in the database — never hardcoded in the frontend.
6. All secrets via environment variables — never in code, git, logs or the frontend.
7. The UIs must be genuinely responsive at 360×800, 390×844, 768×1024, 1024×768, 1366×768,
   1920×1080.
8. Incomplete features and limitations are reported honestly at every phase gate.

## License

MIT (see [`LICENSE`](LICENSE)) — pending owner confirmation (decision D-015).
