#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-http://localhost:8090/api/v1/conditions}
USER_ID=${USER_ID:-demo-user}

create_payload() {
  cat <<JSON
{
  "user_id": "${USER_ID}",
  "label": "Tell me when it's really hot",
  "condition_type": "temperature_hot",
  "latitude": 40.7128,
  "longitude": -74.0060
}
JSON
}

echo "Creating sample condition alert for user ${USER_ID}"
curl -sS -X POST "${API_BASE}/subscriptions" \
  -H "Content-Type: application/json" \
  -d "$(create_payload)" | jq

echo "\nListing conditions for ${USER_ID}"
curl -sS "${API_BASE}/subscriptions/${USER_ID}" | jq

echo "\nRunning dry-run evaluation"
curl -sS -X POST "${API_BASE}/run?dry_run=true" | jq
