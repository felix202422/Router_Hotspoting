-- ============================================================================
-- V2__admin_refresh_tokens.sql — Phase 4 gap fill (decision D-025).
-- The Phase 2 ER omitted storage for admin refresh sessions, but api-contract
-- A2 requires rotation with reuse → revoke-family semantics, which is
-- impossible statelessly. Additive table; V1 stays byte-identical to the
-- approved ER baseline.
-- ============================================================================

CREATE TABLE admin_refresh_tokens (
    id                BIGSERIAL PRIMARY KEY,
    administrator_id  BIGINT       NOT NULL REFERENCES administrators (id),
    token_hash        VARCHAR(128) NOT NULL UNIQUE,   -- SHA-256, raw never stored
    family_id         UUID         NOT NULL,          -- rotation family (reuse detection)
    seq               BIGINT       NOT NULL DEFAULT 0,
    revoked_at        TIMESTAMPTZ,                    -- NULL = current live token
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_family ON admin_refresh_tokens (family_id);
CREATE INDEX idx_refresh_admin ON admin_refresh_tokens (administrator_id);
