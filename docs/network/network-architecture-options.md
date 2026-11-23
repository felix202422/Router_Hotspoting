# Network Architecture — Options and Recommendation

**Phase:** 1 — System Planning and Design
**Status:** Draft for approval; Option B1 recommended; Option C gated on on-site test T7
**Date:** 2026-11-23

---

## 1. Design constraints (from approved decisions)

1. Internet uplink: existing **YAS Tanzania ZTE G5TS 5G** — customers currently connect to its Wi-Fi.
2. The ZTE **cannot enforce paid access** (see `zte-g5ts-feasibility.md`).
3. The business owner is **open to one low-cost enforcement device**.
4. The application runs on an **on-site machine** at the hotspot.
5. The portal must be reachable by customers **before they have internet access** (pre-payment).
6. No equipment beyond what is proven necessary; cost-conscious; modular controller integration.

## 2. The core problem

```
Customer ──► ??? ──► ZTE G5TS ──► Internet
             ▲
      something must be able to say
      "this device may / may not pass traffic"
```

The enforcement point must sit **in the path of customer traffic**. Because all customer traffic
originates at the ZTE's Wi-Fi, the enforcement point must either (a) become the router/AP that
customers connect through, or (b) rely on the ZTE bridging traffic through it (unverified).

---

## 3. Option A — Soft gate (no additional hardware)

```
flowchart LR
  C[Customer devices] -->|Wi-Fi| Z[ZTE G5TS router+AP]
  Z --> INET((Internet))
  S[On-site server<br/>Spring Boot + PostgreSQL] -->|LAN| Z
  S -.->|manual monitoring only| Z
```

The application issues tokens, records payments, sends SMS; the admin **manually** watches the
ZTE's connected-device list and blocks abusers via MAC filtering. **No technical enforcement** —
unpaid users who ignore the portal are not blocked.

- **Cost:** zero additional hardware.
- **Pros:** simplest, uses only existing equipment, no network changes.
- **Cons:** no real access control; revenue leakage is trivial; MAC filtering defeated by MAC
  randomization; manual overhead on the owner.
- **Verdict:** acceptable only as a temporary bootstrap if the budget is truly zero.

## 4. Option B1 — MikroTik Hotspot gateway (RECOMMENDED)

```
flowchart LR
  INET((Internet)) --> Z[ZTE G5TS<br/>router mode + NAT<br/>(untouched)]
  Z -->|LAN cable| MT[MikroTik hAP ax lite<br/>RouterOS **Hotspot** suite:<br/>captive portal · session control<br/>rate limits · client isolation · API]
  MT -->|customer Wi-Fi SSID| C[Customer devices]
  MT -->|LAN| S[On-site server: Pi 5 / mini PC<br/>Docker: Spring Boot · PostgreSQL · Nginx]
  MT <-->|RouterOS API (TCP 8728/8729)| S
  S -->|HTTPS out| MP[M-Pesa Daraja]
  S -->|HTTPS out| SMS[Africa's Talking]
```

The ZTE stays in router mode exactly as today (one Ethernet cable added). The MikroTik becomes
the **customer-facing router + Wi-Fi + captive portal**: it runs RouterOS's built-in **Hotspot**
— a purpose-built paid-access subsystem with voucher/user accounts, per-user rate limits,
session accounting, walled-garden (pre-auth portal reachability), client isolation, and a
documented **RouterOS API** our backend adapter drives.

- **Cost:** one device (MikroTik hAP ax lite class ≈ USD 55–70, *indicative — verify local
  price*) + existing on-site machine.
- **Pros:**
  - Enforcement, captive portal, rate limiting and session accounting are **native, battle-tested
    features** — we integrate, we don't reinvent.
  - Walled garden solves pre-payment portal reachability cleanly.
  - Per-user speed limits implement the package speed profiles directly.
  - No dependence on any unverified ZTE behaviour.
  - ZTE remains the pure internet uplink (5G + its admin Wi-Fi untouched).
- **Cons:**
  - Customers connect to a **new SSID** (communicate the change; keep branding consistent).
  - One modest purchase required; double NAT (harmless for this use case — outbound traffic only).
- **Verdict: recommended primary architecture.**

## 5. Option B2 — Raspberry Pi custom gateway (cost fallback)

Same topology as B1, but a Raspberry Pi 5 (with USB-Ethernet adapter) performs
routing/NAT/transparent redirect via `nftables` + our own portal redirect, and hosts the app.

- **Cost:** comparable to B1 once PSU/case/NIC are included.
- **Pros:** single general-purpose device we fully control; no RouterOS licence/learning curve.
- **Cons:** we must **write and harden security-critical enforcement code ourselves**
  (redirect, bypass rules, race conditions, fail-closed vs fail-open) — more risk, more code,
  slower to a reliable v1.
- **Verdict:** fallback if MikroTik is unobtainable locally; not recommended for v1.

## 6. Option C — ZTE in Bridge mode + single gateway (experimental, gated on test T7)

```
flowchart LR
  INET((Internet)) --> Z[ZTE G5TS<br/>**bridge mode** + Wi-Fi AP<br/>(unverified)]
  Z -->|WAN/LAN port| G[Gateway: Pi or MikroTik<br/>NAT · DHCP · enforcement · app]
  G --> Z
  C[Customer devices] -->|existing ZTE Wi-Fi SSID| Z
```

If on-site test **T7** proves the ZTE's Wi-Fi still serves clients in bridge mode (passing
their traffic out of the WAN/LAN port), then the ZTE becomes a pure modem+AP and a **single**
gateway device does everything — preserving the customers' current SSID and requiring only one
device overall.

- **Cost:** lowest (one device), preserves existing SSID.
- **Pros:** cheapest enforcement; no SSID change; minimal equipment.
- **Cons:** depends on **unverified** ZTE bridge behaviour on a cellular uplink (T7 may fail, or
  may behave oddly with carrier CGNAT); if the gateway also hosts the app, a single NIC must
  separate upstream/downstream — needs a USB-Ethernet adapter and careful design; harder to
  reason about, harder for the owner to troubleshoot.
- **Verdict:** adopt **only if T7 passes cleanly**; otherwise fall back to B1.

## 7. Comparison

| | A — Soft gate | **B1 — MikroTik** | B2 — Pi custom | C — ZTE bridge |
|---|---|---|---|---|
| Real enforcement | ❌ | ✅ native | ✅ (custom code) | ✅ (custom or RouterOS) |
| Captive portal | ❌ | ✅ built-in | ✅ (we build) | ✅ |
| Per-user speed limits | ❌ | ✅ | ⚠️ manual nftables | ⚠️ |
| Session accounting / data usage | ❌ | ✅ | ⚠️ | ⚠️ |
| New customer SSID | no | **yes** | yes | no |
| Extra hardware cost | 0 | 1 device | ~1 device | 1 device |
| Depends on unverified ZTE behaviour | no | **no** | no | **yes (T7)** |
| Security-critical code we must write | none | adapter only | high | high |
| Time to reliable v1 | fastest | **fast** | slow | slow |

## 8. Recommendation

> **Adopt Option B1** (MikroTik RouterOS Hotspot gateway behind the untouched ZTE, on-site server
> running the application stack), with the **`HotspotController` adapter** abstracting it so a
> different controller can replace it later without touching business logic.
>
> - Run on-site test **T7** regardless: if it passes, evaluate **Option C** as a cheaper
>   variant before purchase (decision recorded in the decision log).
> - **Option A** exists only as a zero-budget bootstrap and must be labelled as such
>   (soft gate, documented revenue-leakage limitation).
> - **Option B2** is the fallback if MikroTik hardware is unavailable locally.

## 9. Portal reachability (pre-payment) — how it works

1. Unauthenticated customer connects to the customer SSID → MikroTik Hotspot intercepts HTTP(S)
   and redirects to the portal.
2. The **portal is served by the on-site server**, allowed through the hotspot's **walled
   garden** (portal URL/IP + payment/SMS provider endpoints whitelisted pre-auth).
3. Customer buys (Daraja STK push) → backend verifies → creates MikroTik hotspot user
   (token-based) → sends token by SMS → customer logs in with token → session granted.
4. If the internet uplink drops: portal, package browsing, token login and admin dashboard keep
   working locally; only payment initiation/SMS require the uplink (degraded mode documented
   in the ops runbook).

## 10. Sizing

- Up to 64 concurrent Wi-Fi clients on the G5TS — MikroTik hAP-class and a 4–8 GB Pi/mini-PC
  with Docker Compose (Spring Boot + PostgreSQL + Nginx) comfortably serve a small hotspot
  of this scale. No microservices, no clustering.
