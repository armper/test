# Custom Condition Alerts Design

## Goals
- Allow end users to subscribe to everyday weather conditions (hot, cold, rainy, windy) in addition to NOAA emergency alerts.
- Provide a friendly API that the frontend can use to create, list, update, and delete condition-based alerts with sensible defaults.
- Evaluate user-defined conditions against NOAA forecast data and re-use the existing notification pipeline (Kafka `notify.dispatch.request.v1`).

## Data Model
- **Table:** `condition_alerts`
  - `id SERIAL PRIMARY KEY`
  - `user_id TEXT NOT NULL`
  - `label TEXT NOT NULL`
  - `condition_type TEXT NOT NULL` — enum-like values: `temperature_hot`, `temperature_cold`, `precipitation`, `wind`.
  - `threshold_value DOUBLE PRECISION` — optional (uses defaults when null).
  - `threshold_unit TEXT` — e.g. `fahrenheit`, `mph`, `percent`.
  - `comparison TEXT NOT NULL DEFAULT 'above'` — `above` or `below`.
  - `latitude DOUBLE PRECISION NOT NULL`
  - `longitude DOUBLE PRECISION NOT NULL`
  - `radius_km DOUBLE PRECISION` — optional future use.
  - `channel_overrides JSONB` — per-alert channel toggles (falls back to `user_preferences`).
  - `is_active BOOLEAN NOT NULL DEFAULT true`.
  - `metadata JSONB` — free-form extras like cooldown minutes.
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
  - `last_triggered_at TIMESTAMPTZ` — auditing.

## Service Overview
- New FastAPI microservice `custom-alerts-service`.
- REST endpoints under `/api/v1/conditions`:
  - `POST /subscriptions` — create condition alert with defaults when thresholds omitted.
  - `GET /subscriptions/{user_id}` — list user subscriptions.
  - `PUT /subscriptions/{id}` — update existing alert.
  - `DELETE /subscriptions/{id}` — archive alert (`is_active=false`).
  - `POST /subscriptions/{id}/test` — on-demand evaluation (returns match preview).
- Uses SQLAlchemy with alembic-style simple migration.

## Condition Evaluation
- Pull hourly forecast from NOAA:
  1. `GET /points/{lat},{lon}` → read `properties.forecastHourly`.
  2. Fetch hourly forecast JSON.
- Evaluate the next 6 hours by default.
- Condition logic:
  - Hot: temperature ≥ threshold (default 85°F).
  - Cold: temperature ≤ threshold (default 32°F).
  - Rain: `probabilityOfPrecipitation` ≥ threshold (default 40%) or `shortForecast` contains "rain".
  - Windy: parse `windSpeed` string (use max mph) ≥ threshold (default 25 mph).
- When a condition matches:
  - Produce payload to Kafka `notify.dispatch.request.v1` using same schema as NOAA path (synthetic `match` structure with `match_id` like `cond-{id}-{timestamp}`).
  - Merge user `channel_overrides` with `user_preferences` static channels (fetched from DB).

## Evaluation Workflow
- Background runner in service loops every 10 minutes (configurable) to evaluate active subscriptions.
- Deduplicate triggers via `last_triggered_at` + `cooldown` metadata (default 60 min).
- During TDD/initial integration we expose `POST /api/v1/conditions/run` to drive evaluation manually (used in curl-based tests).

## Testing Strategy
- Pytest for API routes (using test DB).
- `respx` to mock NOAA HTTP responses for deterministic evaluation tests.
- Integration smoke test using Docker (future) but immediate coverage through unit tests.
- Manual verification via curl commands recorded in `docs/custom-condition-alerts.md` once endpoints land.

## Frontend Considerations (follow-up)
- Add dashboard card allowing users to create "It's getting hot" etc.
- Use copy like "Let me know when it's really hot (85°F)".
- Provide toggles for channels and thresholds with helpful defaults.

## Manual Verification

Start the service with a temporary SQLite database and the scheduler disabled:

```bash
cd services/custom-alerts-service
. .venv/bin/activate
export CUSTOM_ALERTS_DATABASE_URI=sqlite:///./custom_alerts.db
export CUSTOM_ALERTS_ENABLE_SCHEDULER=false
uvicorn app.main:app --port 8090
```

In another terminal, exercise the API with `curl`:

```bash
# Create a "when it is hot" alert
curl -sS -X POST http://localhost:8090/api/v1/conditions/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "label": "Tell me when it's really hot",
    "condition_type": "temperature_hot",
    "latitude": 40.7128,
    "longitude": -74.0060
  }' | jq

# List the user's custom alerts
curl -sS http://localhost:8090/api/v1/conditions/subscriptions/demo-user | jq

# Trigger a dry-run evaluation (no Kafka publish, returns matches count)
curl -sS -X POST "http://localhost:8090/api/v1/conditions/run?dry_run=true" | jq
```

The dry-run endpoint reports how many alerts would have fired (`triggered`) without emitting Kafka messages. When ready to publish into Kafka, repeat the call with `dry_run=false` (requires a running Kafka cluster).

## API Summary
- `POST /api/v1/conditions/subscriptions` — create a condition alert; thresholds and units default based on `condition_type`.
- `GET /api/v1/conditions/subscriptions/{user_id}` — list active alerts for a user.
- `PUT /api/v1/conditions/subscriptions/{id}` — update thresholds, labels, or per-alert channel overrides.
- `DELETE /api/v1/conditions/subscriptions/{id}` — deactivate an alert without deleting history.
- `POST /api/v1/conditions/run?dry_run=true|false` — evaluate all alerts immediately; `dry_run=true` returns a match count without producing Kafka messages.
