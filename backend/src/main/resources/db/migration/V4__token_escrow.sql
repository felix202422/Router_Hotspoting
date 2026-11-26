-- D-028 / A22: re-send the SAME access token (FR-T04).
-- Only ACTIVE tokens carry an AES-GCM-encrypted copy of the raw value; the key
-- lives solely in TOKEN_ESCROW_KEY (env). Revoked/expired tokens keep their
-- cipher NULL and stay hash-only → resend returns 409. Additive only:
-- V1/V2/V3 remain byte-identical.
ALTER TABLE access_tokens
    ADD COLUMN raw_token_cipher TEXT;
