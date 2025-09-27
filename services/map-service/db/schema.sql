CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    area geometry(MultiPolygon, 4326) NOT NULL,
    properties JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regions_area ON regions USING GIST (area);
CREATE INDEX IF NOT EXISTS idx_regions_user ON regions (user_id);
