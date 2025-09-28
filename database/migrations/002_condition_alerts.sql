CREATE TABLE IF NOT EXISTS condition_alerts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    label TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    threshold_value DOUBLE PRECISION,
    threshold_unit TEXT,
    comparison TEXT NOT NULL DEFAULT 'above',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_km DOUBLE PRECISION,
    channel_overrides JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_condition_alerts_user ON condition_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_condition_alerts_active ON condition_alerts(is_active);
