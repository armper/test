ALTER TABLE condition_alerts
    ADD COLUMN IF NOT EXISTS next_evaluation_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_condition_alerts_next_eval ON condition_alerts(next_evaluation_at);
