/**
 * Brand & business config — single source of truth for portal/admin identity.
 * PLACEHOLDER VALUES: owner will supply business name, logo, support contacts
 * (decision log open item). Update this file only — nothing is hardcoded elsewhere.
 */
export const BRAND = {
  name: 'HotspotName',
  tagline: 'Fast, affordable Wi-Fi — pay and connect in under a minute.',
  supportPhone: '+255 000 000 000',
  whatsappPhone: '+255 000 000 000',
  supportHours: 'Daily, 07:00 – 22:00 (Africa/Dar_es_Salaam)',
  location: 'Dar es Salaam, Tanzania',
  currency: 'TZS',
} as const;

/** Demo credentials for the mock admin login (Phase 3 only — replaced in Phase 4). */
export const MOCK_ADMIN = {
  email: 'admin@hotspot.co.tz',
  password: 'Admin123!',
  fullName: 'Site Administrator',
} as const;

/**
 * Mock-SMS simulator aid: tokens issued by the mock payment layer appear in the
 * dev "SMS inbox" widget — the API itself NEVER returns the token (FR-A02).
 * The static demo token below belongs to a seeded active subscription so the
 * token-login flow can be exercised without purchasing first.
 */
export const DEMO_TOKEN = 'DEMO-7Q2F-9X3B-2KLM';
