# UI Wireframes & Interface Design

**Phase:** 2 — System Planning and Design
**Status:** Approved baseline (Phase 2 approval: 2026-11-23) — Phase 3 builds exactly to these
**Design language (§14):** primary navy `#0B1F3A` · accent electric blue `#2563EB` · surfaces
white/`#F8FAFC` · success green `#16A34A` · pending amber `#D97706` · failure red `#DC2626`.
Typography: Inter/system UI, base 16 px, tap targets ≥ 44 px, WCAG AA contrast.

---

## 1. Customer portal (mobile-first)

### 1.1 Landing page (captive-portal first view)

```
┌──────────────────────────────────────┐
│ ◆ HotspotName      [EN] [SW]   ☰    │  ← navy header, brand + lang toggle
├──────────────────────────────────────┤
│        Welcome to HotspotName       │
│   Fast, affordable Wi-Fi — pay and   │
│        connect in under a minute     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 1. Choose a package            │  │  ← numbered how-it-works card
│  │ 2. Pay with M-Pesa             │  │
│  │ 3. Get your token by SMS       │  │
│  │ 4. Connect — enjoy!            │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌── Popular ────────────────────┐   │
│  │ 24 Hours        TZS 2,000 →  │   │  ← package cards (from API)
│  │ 7 Days          TZS 8,000 →  │   │
│  └────────────────────────────────┘  │
│                                      │
│  [  Buy a package  ]  ← solid accent │
│  [ I have a token ]  ← outline      │
│                                      │
│  Already have an active subscription?│
│         Yes / No  (§4C)             │
│                                      │
│  Support: +255 … │ WhatsApp │ Call   │
└──────────────────────────────────────┘
```

### 1.2 Purchase flow (3 steps, stepper header)

```
Step: ● Package ─ ● Phone ─ ● Pay
┌──────────────────────────────────────┐
│ ← Back            Buy a package      │
├──────────────────────────────────────┤
│ ● 24 Hours · 24 hours · unlimited     │  ← selectable cards,
│   TZS 2,000                          │     selected = accent border
│ ○ 7 Days    · 7 days  · unlimited    │
│   TZS 8,000                          │
│                                      │
│  [ Continue ]                        │
├──────────────────────────────────────┤
│ Step 2: Phone                        │
│ Mobile number                        │
│ [+255 ▾] [712 345 678 ]             │  ← TZ prefix chip, numeric keypad
│                                      │
│  Order summary                       │
│  24 Hours                TZS 2,000   │
│  Total                   TZS 2,000   │
│  [ Proceed to M-Pesa payment ]       │
├──────────────────────────────────────┤
│ Step 3: Pay                          │
│ ⏳ Check your phone — approve the    │
│    M-Pesa prompt                     │  ← polling P3, 3s interval
│    Amount: TZS 2,000                 │
│    [ Cancel ]      … auto-redirect   │
├──────────────────────────────────────┤
│ ✔ Payment confirmed!                 │
│ Your access token has been sent by   │
│ SMS to +255 712 345 678.             │
│ Connection will start automatically. │
│ [ Done ]                             │
└──────────────────────────────────────┘
```
States: `PENDING → SUCCESS | FAILED(reason + Retry)`. SMS failure shows honest fallback:
*"Payment received. Token SMS delayed — use Resend from support or your account view."*

### 1.3 Token login

```
┌──────────────────────────────────────┐
│ ← Back     Connect with token        │
├──────────────────────────────────────┤
│ Already have an active subscription? │
│  ( ) Yes, I have a token             │
│  ( ) No, I want to buy a package     │
│                                      │
│ Access token                         │
│ [ enter token____________ ] [Show]   │
│                                      │
│  [ Connect ]                         │
│  ⚠ 5 attempts remaining             │
│                                      │
│ Lost your phone? → Request device    │
│ replacement (admin approval)         │
└──────────────────────────────────────┘
```

### 1.4 My subscription (after login / via SMS link)

```
┌──────────────────────────────────────┐
│ ◆ HotspotName        My subscription │
├──────────────────────────────────────┤
│ ┌ Active ────────────────────────┐   │  ← green chip
│ │ Package      24 Hours          │   │
│ │ Started      23 Nov, 17:05     │   │  ← Africa/Dar_es_Salaam
│ │ Expires      24 Nov, 17:05     │   │
│ │ Remaining    21h 43m           │   │
│ │ Device       This phone ✓      │   │
│ │ Status       Connected ✓       │   │
│ └────────────────────────────────┘   │
│  [ Request device replacement ]      │
│  [ Buy another package ]             │
└──────────────────────────────────────┘
```

### 1.5 Responsive behaviour (portal)

| Viewport | Layout change |
|---|---|
| 360×800 / 390×844 | Single column, sticky bottom CTA, full-width cards, stepper collapses to `1/3` |
| 768×1024 | Two-column package grid, centered 560 px content column |
| 1024×768 → 1920×1080 | Centered 640 px "phone-frame" card on branded navy backdrop (portal stays simple — no desktop sprawl) |

## 2. Administrator dashboard (desktop-first)

### 2.1 Shell (all pages)

```
┌────────────┬──────────────────────────────────────────────┐
│ ◆ Hotspot  │  ☰ (mobile)  Search…            Admin ▾ 🔔  │
│ ADMIN      ├──────────────────────────────────────────────┤
│            │                                              │
│ Overview   │            <page content>                    │
│ Customers  │                                              │
│ Packages   │                                              │
│ Subscr.    │                                              │
│ Payments   │                                              │
│ Network ●  │                                              │
│ Analytics  │                                              │
│ Audit log  │                                              │
│ ─────────  │                                              │
│ Settings   │                                              │
│ Logout     │                                              │
└────────────┴──────────────────────────────────────────────┘
  240 px fixed    flex-1, max-width 1440 px, 24 px gutters
```

**Responsive:** ≥1280 px expanded sidebar · 1024–1279 icon-only rail (tooltips) ·
<1024 px sidebar becomes overlay drawer via ☰ + scrim · <768 px tables restack as cards ·
fixed bottom safe-area spacing; charts resize via Recharts `ResponsiveContainer`.

### 2.2 Overview

```
┌ Revenue today   TZS 48,000   ▲12%   ┐┌ Active subs      137   ┐┌ Connected now   42  ┐
│ This week 214,000 │ This month 892,000  ││ Purchases (all) 1,204 ││ Expired (30d)    61  │
│ This year 4.1M    │ Total      12.8M    ││ Failed 8 │ Pending 3  ││ Enforcement: ON ✓ │
└───────────────────┘└────────────────────┘└───────────────────────┘┘
┌ Revenue, last 30 days (TZS) ────────────────────────────────┐
│ ▁▂▃▅▄▆▇█▇▆▅▄▃▂▁▂▃▅▇▆…            [Day ▾] [Package ▾] [All ▾]│  ← area chart
└─────────────────────────────────────────────────────────────┘
┌ Recent payments ────────────────── [View all →] ┐
│ 17:04  +255712…  24 Hours   2,000  M-Pesa ●OK   │
│ 16:58  +255755…  1 Hour       500  M-Pesa ●FAIL │
└─────────────────────────────────────────────────┘
```

### 2.3 Key tables (Customers / Subscriptions / Payments / Audit)

```
Search [phone…… ] Filters: [Status ▾][Date range ▾]        [Export CSV]
┌──────────┬────────────┬───────────┬──────────┬──────────┬──────────┐
│ Phone    │ Package    │ Status    │ Expires  │ Device   │ Actions  │
├──────────┼────────────┼───────────┼──────────┼──────────┼──────────┤
│ 0712…678 │ 24 Hours   │ ●Active   │ 24 Nov   │ This one │ ▸ menu   │
└──────────┴────────────┴───────────┴──────────┴──────────┴──────────┘
‹ 1 2 3 … 24 ›   showing 1–25 of 587
```
- Row actions menu: suspend / revoke / disconnect / approve replacement / resend token —
  every mutation confirms with a modal (`Are you sure?` + consequence text) then toasts
  `✓ / ✗` feedback (§14 "clear feedback for every important action").
- **Small screens:** each `<tr>` becomes a stacked card: primary line = phone/package,
  secondary lines = key:value pairs, actions = full-width buttons. No horizontal scroll.

### 2.4 Package editor (drawer, not page)

```
Drawer ─ Edit "24 Hours"                     ✕
Name [24 Hours        ]  Price [2,000 TZS   ]
Duration [24] [hours ▾]  Data allowance [∞ ▾ ]
Down [10 Mbps ▾]  Up [5 Mbps ▾]  Devices [1 ▾]
Description [………………]
Status: ● Active   [ Save ]  [ Deactivate ]
Validation inline: price > 0 · duration > 0
```

### 2.5 Network page (controller-backed only)

```
Health: ● MikroTik reachable · last sync 12s ago · drift: none
┌ IP            Device          Subscription   Connected   Usage      Actions ┐
│ 10.10.0.23    Android·Tecno   #42 24 Hours   1h 12m      214 MB     [⋯]    │
└─────────────────────────────────────────────────────────────────────────────┘
[Offline state] ⚠ Controller unreachable — live session data unavailable.
                (page shows last-known-with-timestamp + warning; never fabricated)
```

### 2.6 Analytics page

```
Filters: [From 2026-11-01] [To 2026-11-23] [Package ▾] [Status ▾] [Export CSV]
┌ TZS gross 892,000 ┐┌ Successful 461 ┐┌ Refunded 12,000 ┐┌ Returning 38% ┐
└───────────────────┘└────────────────┘└─────────────────┘└───────────────┘
[Revenue ▾ bar/line]        [Packages ▾ pie]      [New vs returning ▾]
Transaction table (same component as Payments, filter-bound)
```
`profitTzs: null` rendered as "Profit: — (expenses not tracked yet)" — never implied (FR-R05).

## 3. Cross-cutting UI rules

1. **Feedback:** every action → button loading state → success toast or inline error (no silent failures).
2. **Empty states:** illustrated "No data yet" + next-step hint (network page uses the honest
   offline state above).
3. **Security UX:** token inputs are `type=password` with show-toggle; tokens never appear in
   URLs, toasts or logs; admin sessions warn "expired, please log in again".
4. **i18n:** portal strings externalized (EN default, SW optional — flag `portal.i18n`); admin EN.
5. **Accessibility:** focus rings, aria-labels on icon buttons, `prefers-reduced-motion` respected,
   semantic headings, contrast ≥ 4.5:1 (NFR-02).
6. **Consistency:** shared component library (`Button, Card, Table, Drawer, Modal, Toast, Badge,
   StatCard, EmptyState, Stepper, Pagination`) — no one-off page styles (§2 clean architecture).
