CREATE TABLE IF NOT EXISTS alert_delivery_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    source TEXT NOT NULL,
    source_id TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    severity TEXT,
    channels JSONB NOT NULL DEFAULT '{}'::jsonb,
    triggered_at TIMESTAMPTZ NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_delivery_history (user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_delivery_history (triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_source ON alert_delivery_history (source);
