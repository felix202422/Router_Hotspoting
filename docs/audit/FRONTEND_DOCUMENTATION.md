# Frontend Documentation

**Stack:** React 18.3 · TypeScript ~5.6 (strict) · Vite 5.4 · Tailwind 3.4 · React Router 6.28 ·
Recharts 2.13 · lucide-react · version `0.3.0` (`frontend/package.json`).
**Build:** `npm run build` = `tsc && vite build` — ✅ **PASS (EXIT=0)**, 2,215 modules,
735 kB JS / 206 kB gzip + 29 kB CSS (chunk-size warning only, known false positive).
**No test runner and no linter configured** (no vitest/jest/eslint in `package.json`).

---

## 1. Pages & routes (verified in `src/App.tsx`)

### 1.1 Customer portal (mobile-first, `PortalLayout`: lime header, mint bg, support footer)

| Route | File | Purpose & key behaviour |
|---|---|---|
| `/` | `pages/portal/LandingPage.tsx` | Hero (forest panel + citrus Wi-Fi chip), "How it works" (4 steps), **live package list from `listPackages()`** (never hardcoded — FR-C02), CTAs: Buy a package / I have a token. Loading spinner, inline error + retry, empty state |
| `/buy` | `pages/portal/PurchasePage.tsx` | 3-step Stepper: ① pick package ② enter TZ phone + review price ③ STK-push polling (`setInterval` on `getPurchase()` until terminal status; transient poll errors keep polling). Demo rule: phones ending `0000` fail. Success screen shows how the token arrives **by SMS only** (FR-A02) |
| `/connect` | `pages/portal/TokenLoginPage.tsx` | Token entry + persistent browser **device fingerprint** (generated once, reused). Generic 401 messaging (FR-C11), rate-limit aware. Success → `/subscription`. Dev-only `MockSmsInbox` shows the simulated SMS |
| `/subscription` | `pages/portal/SubscriptionPage.tsx` | Package, status, activation/expiry, 1-second countdown timer, device registration state (FR-C08). Empty/error states when no token/subscription |
| `/device-replacement` | `pages/portal/DeviceReplacementPage.tsx` | Request form → PENDING until admin approval (FR-C09); explanation panel; success acknowledgement |
| `*` | `pages/NotFoundPage.tsx` | 404 with "go home" CTA |

### 1.2 Admin console (desktop-first, `AdminLayout`: forest sidebar ≥1024px, hamburger drawer <1024px)

| Route | File | Purpose & key behaviour |
|---|---|---|
| `/admin/login` | `pages/admin/AdminLoginPage.tsx` | Email/password, **inline** errors (never toast-only), demo-credentials hint, citrus chip branding |
| `/admin` | `pages/admin/OverviewPage.tsx` | KPI StatCards (revenue today/week/month/year/total, active subs, connected, purchases, expired, failed/pending — FR-D01), 30-day revenue area chart, recent payments table, "Enforcement ON" badge |
| `/admin/customers` | `pages/admin/CustomersPage.tsx` | Search by phone, paginated list, detail drawer (current subscription + purchase history), suspend/reactivate, force-disconnect (A8/A12) |
| `/admin/packages` | `pages/admin/PackagesPage.tsx` | CRUD form (price TZS int, duration with unit converter, data/speed/device limits, description), activate/deactivate, status filters (FR-P01) |
| `/admin/subscriptions` | `pages/admin/SubscriptionsPage.tsx` | Filters (status/search/expiring-within), suspend/resume/revoke actions with confirm dialogs (A17/A19/A20), stacked-card view <1024px |
| `/admin/payments` | `pages/admin/PaymentsPage.tsx` | Filterable table (from/to/status/package/phone), status badges, resend-token action (A21/A22) |
| `/admin/network` | `pages/admin/NetworkPage.tsx` | Controller health + live sessions (IP, device, duration, bytes), disconnect action — **renders only what the API returns; empty state when unreachable** (FR-D06 "never fabricated") |
| `/admin/analytics` | `pages/admin/AnalyticsPage.tsx` | Date-range + package + status filters, revenue bars, package share pie, customer analytics, **CSV export** (`utils/csv.ts` client-side formatting), TZ-day buckets (FR-R01–R04) |
| `/admin/audit` | `pages/admin/AuditLogPage.tsx` | Read-only audit trail with actor/action/entity filters (§15) |

Navigation: `AdminLayout.NAV` = Overview, Customers, Packages, Subscriptions, Payments, Network,
Analytics, Audit log. Active item = citrus highlight; profile + logout in top bar.

## 2. Component library (`src/components/`, 16 components)

| Component | Notes |
|---|---|
| `Button` | variants: primary (**citrus CTA, dark forest text — ≥4.5:1**), secondary (forest), outline, danger, success, ghost; sizes sm/md/lg; `loading` spinner, `icon`, `block` |
| `Card` | white, rounded-xl, `shadow-card`, optional `title`/`action`/`flush` |
| `Badge` | tones success/warning/danger/info/neutral + optional dot (green-amber-red semantics, NFR-02) |
| `StatCard` | KPI card with label/value/sub/trend/icon |
| `Input`/`Field`/`Textarea`/`Select` | labels + required marks, focus ring `leaf-500`, error text, 44px targets |
| `Modal` / `Drawer` / `ConfirmDialog` | accessible dialogs; drawer slide-in |
| `DataTable` | **table at ≥1024px, stacked key/value cards below** (md→lg fix this session; NFR-01 never horizontal scroll), row click, aligned columns, `hideOnMobile` |
| `Pagination` | page/size controls |
| `Stepper` | 3-step purchase flow indicator |
| `Toast` | `ToastProvider` + hook; success/error notices |
| `Spinner` / `EmptyState` / `PageHeader` | loading/empty/page headers |

Design tokens (`tailwind.config.js`, D-026 green refresh): `mint-50…300` (page bg `#EAF7E1`),
`forest-950…600` (panels/sidebar/hero `#163019`), `leaf-50…800` (accents/links/focus),
`citrus-50…700` (CTAs `#F5A623` + dark text). Theme-color `#163019`. Old `navy-*`/`electric-*`
names were mechanically renamed across 22 files (no layout change).

## 3. State, data & auth flows

- **Data:** every page imports only from `services/api.ts` (D-022 single facade). Mock/live switch
  is a single env var `VITE_API_MODE` (default = mock). Loading/error/empty states implemented
  page-by-page (no global store — local `useState` + `useEffect`).
- **Auth:** `AuthProvider` → `login()` calls `adminLogin()`, stores profile + tokens in
  `localStorage`; `RequireAuth` gates all `/admin/**` except `/admin/login`; `logout()` clears
  storage. **No silent refresh (A2) and no server-side logout (A3) call** — live-mode sessions
  would expire unrefreshed after 15 minutes.
- **Polling:** PurchasePage polls P3 during payment; SubscriptionPage ticks a countdown; no other
  intervals.
- **Errors:** `ApiError` (RFC 9457 mirror) with `title/status/detail`; pages render inline alerts.

## 4. Responsive & accessibility (verified this session)

- **Responsive matrix executed:** 12 routes × 6 viewports
  (360×800, 390×844, 768×1024, 1024×768, 1366×768, 1920×1080) via an iframe harness against the
  production build — **zero horizontal overflow on every combination**, zero console errors on
  landing/admin-login/overview/analytics. Harness file removed afterwards.
- One real defect found & fixed during verification: dense admin tables overflowed 768 px
  (`DataTable` showed tables at `md`) → card view now extends to `<1024px`.
- Accessibility: semantic landmarks, aria-labels on icon buttons, `aria-current` nav, focus-visible
  rings, 44px `.tap` targets, contrast: citrus CTA text ≈7:1, header lime/forest ≈15:1 (NFR-02
  WCAG AA). Not formally audited with Lighthouse (check not completed — see TESTING_REPORT).
- Visual verification: screenshots unavailable in this environment (browser tool requires a visible
  desktop window); verification was done via computed styles + DOM measurements instead.

## 5. Known frontend gaps

1. **Live mode is untested end-to-end** — backend has no endpoints (client branches would 404).
2. No refresh/logout server calls (A2/A3) — see §3.
3. `adminLogout()` never notifies the server; refresh token remains valid until expiry.
4. Mock admin login compares plaintext demo credentials client-side (fine for demo; must never
   ship as the real login path — it doesn't: live mode uses A1).
5. No ESLint/Prettier; type-safety relies on `tsc` alone.
6. No frontend unit tests (none configured).
7. Bundle 735 kB (>500 kB warning) — code-splitting not configured; acceptable for LAN use but
   flagged for NFR-05 tuning later.
