-- ============================================================================
-- V3__session_ip_nullable.sql — Phase 1 stabilization (audit finding KI-6).
-- The hotspot controller does not know the client IP until the MikroTik sync
-- (Phase 5), and the old code stored a placeholder address, which made the
-- admin dashboard show fabricated data (FR-D06 "never fabricated"). Relaxing
-- NOT NULL lets sessions record NULL instead. Constraint-relaxing and
-- additive only; V1/V2 stay byte-identical to the approved baselines.
-- ============================================================================

ALTER TABLE active_sessions ALTER COLUMN ip_address DROP NOT NULL;
