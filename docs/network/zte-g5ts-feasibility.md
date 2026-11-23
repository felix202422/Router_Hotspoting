# ZTE G5TS 5G — Hotspot Capability Feasibility Report

**Phase:** 1 — Requirements and Hardware Feasibility
**Status:** Preliminary findings complete; hands-on verification pending (see checklist)
**Date:** 2026-11-23

---

## 1. Purpose

The paid Wi-Fi system requires a network enforcement point: the ability to **grant, limit and
revoke internet access per subscriber, per session**. This report establishes what the existing
YAS Tanzania ZTE G5TS 5G router can and cannot do, before any hardware purchase decision is made.

## 2. Sources

- ZTE G5TS product page — https://www.ztedevices.com/en/products/mobile-internet/5g-fwa/g5ts.html
- ZTE G5TS 5G Indoor CPE data sheet (ZTE, 2025) — media.dustin.eu datasheet PDF
- ZTE G5TS Quick Start Guide (Afrihost / ZTE, 2025) — https://www-dev-cms.afrihost.com/uploads/devices/documents/G5TS-Quick-Start-Guide.pdf
- ZTE G5TS spec sheet (Axxess) — https://www.axxess.co.za/files/108213/device-zte-GTS-5G.pdf
- YAS Tanzania device page — https://yas.co.tz/devices/zte-g5ts
- Independent manuals summary — manuals.plus G5TS entry

## 3. Executive conclusion

> **The ZTE G5TS provides internet connectivity and basic static firewall controls, but it has
> NO captive portal, NO RADIUS support, NO documented public session-management API, and NO
> hotspot authentication feature. It cannot, by itself, enforce paid access.**

This matches the assumption stated in the master prompt ("do not assume the ZTE supports captive
portal, RADIUS or external hotspot APIs") — now confirmed against official documentation.

## 4. Capability matrix

| Capability | Status | Notes |
|---|---|---|
| Captive portal / web authentication | ❌ Not present | Not listed in any official spec or WebUI documentation |
| RADIUS client/server | ❌ Not present | — |
| Public local API for session control | ❌ Not present | TR-069/TR-181 + MQTT are **ISP-side** remote-management protocols, not a third-party integration API |
| Hotspot / voucher / token features | ❌ Not present | — |
| Network modes | ✅ Automatic, Hybrid, Wireless, **Bridge**, Cable Broadband, Dual WAN | Matches the modes seen on the unit |
| Static firewall controls | ✅ Port forwarding/filtering/mapping, domain filtering, **MAC address filtering**, UPnP, DMZ | All manually configured, admin-UI only, no API |
| Connected-device management | ✅ Basic | WebUI list of connected devices; actions limited (manual, no API) |
| Parental control / time management | ✅ Listed in spec | Per-device time limits exist — *possibly usable as crude manual enforcement, per-device, no automation* |
| Guest SSID | ✅ Supported | Isolation of a guest network, but **no authentication gate** on it |
| Client isolation / forwarding restrictions | ⚠️ Partial | Guest SSID isolation only; no documented per-client isolation on main SSID |
| Speed limiting per client | ❌ Not documented | No per-client QoS in the consumer WebUI |
| Wi-Fi while in Bridge mode | ⚠️ **Unverified** | Quick-start guide only documents **wired** clients in bridge mode. Critical open question — see test T7 |
| Bridge-mode uplink semantics on 5G | ⚠️ **Unverified** | Guide says the bridged client "obtains an IP from the WAN DHCP host" — behaviour with a cellular (CGNAT) uplink must be tested on-site |
| OpenWrt | ❌ Not available in practice | Listed only as "*optional customized software features*"; retail/YAS firmware does not expose it |
| Concurrent Wi-Fi clients | ✅ Up to 64 | Adequate for a small hotspot |
| Hardware capacity | ✅ Wi-Fi 6 AX1500, 4× GbE, quad-core | Fine as the internet uplink for the site |

## 5. What this means for the system

1. **Enforcement must live in a device we control.** The application can decide *who deserves
   access*, but something must *enforce* that decision. The G5TS cannot.
2. **The G5TS remains valuable as the internet uplink** (5G, NAT, its own LAN/Wi-Fi) — it is not
   discarded; it sits upstream of the enforcement point.
3. **A modular `HotspotController` adapter** is mandatory so the business logic never depends on
   one specific enforcement device (see `hotspot-adapter-design.md`).
4. **Manual-only features (MAC filtering, parental time limits) are not a substitute**: no
   automation, no API, MAC randomization on modern phones defeats MAC-based identity anyway.

## 6. Hands-on verification checklist (for the on-site unit)

> **Owner:** on-site operator. **Purpose:** confirm/refute the findings above *on the actual
> firmware*, and settle the two ⚠️ open questions. **Time:** ~30 minutes, off-peak.
> Record answers + screenshots; they will be appended to this report.

| # | Test | How | What to record |
|---|---|---|---|
| T1 | Firmware/menu inventory | Log in to `192.168.0.1`, photograph the full left-hand menu tree | Firmware version; any menu containing *Hotspot, Portal, Captive, RADIUS, API* |
| T2 | Network modes | Network → Network Mode | Exact list of modes offered on this unit |
| T3 | Search for auth features | Use the WebUI search (if present) for: hotspot, portal, radius, voucher, auth | Presence/absence of each |
| T4 | Parental control depth | Parental Control menu | Can a specific connected device be time-limited or blocked? Manual only? |
| T5 | Connected-device actions | Connected Device Management | What actions exist per device (block? limit? info shown?) |
| T6 | Guest SSID behaviour | Enable guest SSID, connect a phone | Does guest reach LAN devices? Any login page? Speed limited? |
| T7 | **Bridge-mode Wi-Fi test (critical)** | Off-peak: switch to Bridge Mode, connect a laptop by cable **and** a phone by Wi-Fi | Does Wi-Fi still broadcast? Does the phone get an IP and reach the internet? What IP range (carrier CGNAT or LAN)? **Revert to previous mode afterwards** |
| T8 | TR-069 lock status | System / TR-069 menus | Is remote management ISP-locked (hidden menus)? |
| T9 | Baseline admin security | Admin password, remote access, ping switch | Defaults changed? Remote access disabled? |

**Decision rule:**
- If T7 shows Wi-Fi clients work normally in bridge mode → **Option C** (ZTE as bridge+AP, single
  gateway device) becomes viable and cheapest.
- If T7 fails → **Option B1** (MikroTik gateway provides the customer SSID, ZTE stays in router
  mode untouched) is the recommended path — it does not depend on any unverified ZTE behaviour.

## 7. Risks and limitations (honest disclosure)

- No amount of software on the ZTE can block unpaid users; any "existing-hardware-only" approach
  is a **soft gate** relying on honesty and manual admin action.
- MAC addresses cannot be permanent device identity (randomized MACs) — device binding must be
  session-based with MAC as a weak secondary signal.
- Ordinary network controls cannot guarantee prevention of all internet tethering/sharing; this
  limitation must be disclosed to the business owner and, where appropriate, to customers.
- Bridge-mode behaviour on a cellular uplink is vendor-specific and **must be verified on-site**
  before being relied upon.

## 8. Next step

Complete checklist T1–T9, attach screenshots, then finalize this report and lock the network
architecture choice in `network-architecture-options.md`.
