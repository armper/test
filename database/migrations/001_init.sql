CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS user_accounts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    raw JSONB NOT NULL,
    normalized JSONB,
    severity TEXT,
    sent TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    label TEXT,
    area GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_area ON alert_subscriptions USING GIST (area);

CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    channels JSONB NOT NULL DEFAULT '{}'::jsonb,
    quiet_hours JSONB,
    severity_filter TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_dispatch_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_outcomes (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    message_id TEXT,
    error TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
