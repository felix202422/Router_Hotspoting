-- ============================================================================
-- V1__init.sql — complete Phase 2 schema (docs/database/er-diagram.md, approved)
-- Conventions: BIGSERIAL PKs · money = BIGINT TZS (integer) · times TIMESTAMPTZ
-- (stored UTC) · financial rows are never hard-deleted (NFR-06, FR-A06).
-- ============================================================================

-- ---------------------------------------------------------------- administrators
CREATE TABLE administrators (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'ADMIN',
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------- customers
CREATE TABLE customers (
    id              BIGSERIAL PRIMARY KEY,
    phone_e164      VARCHAR(15)  NOT NULL UNIQUE,   -- +255XXXXXXXXX, normalized
    display_name    VARCHAR(120),
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    first_seen_at   TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_status ON customers (status);

-- ----------------------------------------------------------------------- packages
CREATE TABLE packages (
    id                   BIGSERIAL PRIMARY KEY,
    name                 VARCHAR(80)  NOT NULL,
    description          VARCHAR(500),
    price_tzs            BIGINT       NOT NULL CHECK (price_tzs > 0),
    duration_seconds     INTEGER      NOT NULL CHECK (duration_seconds > 0),
    data_allowance_bytes BIGINT,                      -- NULL = unlimited
    max_download_kbps    INTEGER,                     -- NULL = unlimited
    max_upload_kbps      INTEGER,
    device_limit         INTEGER      NOT NULL DEFAULT 1 CHECK (device_limit >= 1),
    status               VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    sort_order           INTEGER      NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_packages_status_sort ON packages (status, sort_order);

-- ---------------------------------------------------------------------- payments
-- (activated_subscription_id FK added below, after subscriptions exists)
CREATE TABLE payments (
    id                        BIGSERIAL PRIMARY KEY,
    idempotency_key           VARCHAR(64)  NOT NULL UNIQUE,  -- = opaque purchaseId
    customer_id               BIGINT       NOT NULL REFERENCES customers (id),
    package_id                BIGINT       NOT NULL REFERENCES packages (id),
    amount_tzs                BIGINT       NOT NULL CHECK (amount_tzs > 0),
    provider                  VARCHAR(30)  NOT NULL,
    provider_reference        VARCHAR(100) UNIQUE,           -- NULL until provider assigns
    phone_e164                VARCHAR(15)  NOT NULL,         -- snapshot at purchase
    status                    VARCHAR(20)  NOT NULL,
    failure_reason            VARCHAR(255),
    activated_subscription_id BIGINT,                        -- idempotent activation anchor
    paid_at                   TIMESTAMPTZ,
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_customer_created ON payments (customer_id, created_at);
CREATE INDEX idx_payments_status_paid_at   ON payments (status, paid_at);

-- ----------------------------------------------------------------- subscriptions
CREATE TABLE subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT      NOT NULL REFERENCES customers (id),
    package_id      BIGINT      NOT NULL REFERENCES packages (id),
    payment_id      BIGINT      NOT NULL REFERENCES payments (id),
    status          VARCHAR(20) NOT NULL,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
    activated_at    TIMESTAMPTZ,
    suspended_reason VARCHAR(255),
    extension_count INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_status_ends_at ON subscriptions (status, ends_at);
CREATE INDEX idx_subscriptions_customer_status ON subscriptions (customer_id, status);

-- close the payments ↔ subscriptions idempotency anchor (added after both exist)
ALTER TABLE payments
    ADD CONSTRAINT fk_payments_activated_subscription
    FOREIGN KEY (activated_subscription_id) REFERENCES subscriptions (id);

-- --------------------------------------------------------------- access_tokens
CREATE TABLE access_tokens (
    id              BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT      NOT NULL REFERENCES subscriptions (id),
    token_hash      VARCHAR(128) NOT NULL UNIQUE,  -- SHA-256; raw token never stored
    token_hint      VARCHAR(8)   NOT NULL,         -- last 4 chars for admin display
    status          VARCHAR(20)  NOT NULL,
    issued_at       TIMESTAMPTZ  NOT NULL,
    expires_at      TIMESTAMPTZ  NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_tokens_subscription_status ON access_tokens (subscription_id, status);

-- ------------------------------------------------------------ registered_devices
CREATE TABLE registered_devices (
    id                  BIGSERIAL PRIMARY KEY,
    subscription_id     BIGINT       NOT NULL REFERENCES subscriptions (id),
    device_fingerprint  VARCHAR(64)  NOT NULL,   -- controller session id + UA hash (MAC = weak hint)
    mac_hint            VARCHAR(17),
    device_label        VARCHAR(120),
    status              VARCHAR(20)  NOT NULL,
    bound_at            TIMESTAMPTZ,
    unbound_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_subscription_status ON registered_devices (subscription_id, status);

-- --------------------------------------------------------------- active_sessions
CREATE TABLE active_sessions (
    id                    BIGSERIAL PRIMARY KEY,
    subscription_id       BIGINT       NOT NULL REFERENCES subscriptions (id),
    controller_session_id VARCHAR(64)  NOT NULL UNIQUE,
    ip_address            INET         NOT NULL,
    mac_hint              VARCHAR(17),
    started_at            TIMESTAMPTZ  NOT NULL,
    ended_at              TIMESTAMPTZ,             -- NULL = live
    end_reason            VARCHAR(30),             -- LOGOUT/EXPIRED/REVOKE/DISCONNECT/REPLACE
    bytes_in              BIGINT       NOT NULL DEFAULT 0,
    bytes_out             BIGINT       NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_subscription_started ON active_sessions (subscription_id, started_at);
CREATE UNIQUE INDEX uq_sessions_live ON active_sessions (subscription_id)
    WHERE ended_at IS NULL;                        -- one live session per subscription

-- --------------------------------------------------- device_replacement_history
CREATE TABLE device_replacement_history (
    id                BIGSERIAL PRIMARY KEY,
    customer_id       BIGINT       NOT NULL REFERENCES customers (id),
    subscription_id   BIGINT       NOT NULL REFERENCES subscriptions (id),
    request_reason    VARCHAR(500) NOT NULL,
    old_device_label  VARCHAR(120),
    new_device_label  VARCHAR(120),
    status            VARCHAR(20)  NOT NULL,
    reviewed_by       BIGINT       REFERENCES administrators (id),
    reviewed_at       TIMESTAMPTZ,
    rejection_reason  VARCHAR(500),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_replacements_status_created ON device_replacement_history (status, created_at);
CREATE INDEX idx_replacements_customer ON device_replacement_history (customer_id);

-- ------------------------------------------------------------ sms_notifications
CREATE TABLE sms_notifications (
    id                 BIGSERIAL PRIMARY KEY,
    customer_id        BIGINT       NOT NULL REFERENCES customers (id),
    subscription_id    BIGINT       REFERENCES subscriptions (id),
    type               VARCHAR(30)  NOT NULL,      -- TOKEN/CONFIRMATION/EXPIRY/…
    phone_e164         VARCHAR(15)  NOT NULL,
    body_redacted      VARCHAR(500) NOT NULL,      -- token masked: "****7Q2F" (FR-T02/T04)
    provider           VARCHAR(30)  NOT NULL,
    provider_message_id VARCHAR(100),
    status             VARCHAR(20)  NOT NULL,      -- QUEUED/SENT/DELIVERED/FAILED
    attempts           INTEGER      NOT NULL DEFAULT 0,
    last_error         VARCHAR(255),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_status_created ON sms_notifications (status, created_at);

-- -------------------------------------------------------- payment_webhook_events
CREATE TABLE payment_webhook_events (
    id                BIGSERIAL PRIMARY KEY,
    provider          VARCHAR(30)  NOT NULL,
    provider_event_id VARCHAR(128) NOT NULL,        -- replay protection (FR-M03)
    payment_id        BIGINT       REFERENCES payments (id),
    signature_valid   BOOLEAN      NOT NULL,
    payload           JSONB        NOT NULL,        -- raw, secrets stripped
    processing_status VARCHAR(20)  NOT NULL,        -- RECEIVED/PROCESSED/IGNORED/ERROR
    processed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_event_id)
);

-- ------------------------------------------------------------ system_audit_logs
CREATE TABLE system_audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    actor_type   VARCHAR(20)  NOT NULL,             -- ADMIN/SYSTEM
    actor_id     BIGINT,
    action       VARCHAR(60)  NOT NULL,
    entity_type  VARCHAR(40)  NOT NULL,
    entity_id    BIGINT       NOT NULL,
    before_json  JSONB,
    after_json   JSONB,
    ip_address   INET,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON system_audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_created ON system_audit_logs (created_at);

-- -------------------------------------------------- operational_expenses (v1.1 stub)
CREATE TABLE operational_expenses (
    id          BIGSERIAL PRIMARY KEY,
    category    VARCHAR(60)  NOT NULL,
    amount_tzs  BIGINT       NOT NULL CHECK (amount_tzs >= 0),
    incurred_on DATE         NOT NULL,
    note        VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================================
-- Seed packages (Phase 2 baseline — editable by the owner in the admin UI, FR-P02)
-- ============================================================================
INSERT INTO packages (name, description, price_tzs, duration_seconds, data_allowance_bytes,
                      max_download_kbps, max_upload_kbps, device_limit, status, sort_order)
VALUES
    ('1 Hour',  'Quick browse & social media',        500,   3600,    NULL, 5120,  2560,  1, 'ACTIVE', 1),
    ('3 Hours', 'Study & streaming session',          1000,  10800,   NULL, 8192,  4096,  1, 'ACTIVE', 2),
    ('12 Hours','Full day of work & fun',             1500,  43200,   NULL, 10240, 5120,  1, 'ACTIVE', 3),
    ('24 Hours','Unlimited for a full day',           2000,  86400,   NULL, 10240, 5120,  1, 'ACTIVE', 4),
    ('7 Days',  'Best value for a week',              8000,  604800,  NULL, 10240, 5120,  2, 'ACTIVE', 5),
    ('30 Days', 'Monthly unlimited',                  25000, 2592000, NULL, 20480, 10240, 2, 'ACTIVE', 6);
