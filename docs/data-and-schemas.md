# Data & Schemas

Reference for Avro contracts, database structure, and data flow conventions within the Weather Alerts Enterprise Platform.

## 1. Kafka topics
| Topic | Producer(s) | Consumer(s) | Payload highlights |
| --- | --- | --- | --- |
| `noaa.alerts.raw.v1` | `alerts-normalizer-svc` | Internal troubleshooting, archival | Raw NOAA feature payloads |
| `noaa.alerts.normalized.v1` | `alerts-normalizer-svc` | `alerts-matcher-svc`, downstream analytics | Normalized alert envelope with geometry, categories, severity |
| `alerts.matches.user.v1` | `alerts-matcher-svc` | Notification orchestration services | User-specific match records including polygon IDs and delivery context |
| `notify.dispatch.request.v1` | `alerts-matcher-svc` | `notification-router-service` | Pending notifications awaiting routing rules |
| `notify.{email,push,sms}.request.v1` | `notification-router-service` | Channel workers (`email-worker`, `push-worker`, `sms-worker-service`) | Channel-specific payloads with message bodies |
| `notify.outcome.v1` | Channel workers | `admin-service`, analytics, audits | Delivery result (success/failure) with metadata |
| `dlq.*` | Any producer | Operators, replay tooling | Dead-letter topics for poison messages |

### Avro governance
- Source files live in [`schemas/avro`](../schemas/avro).
- Run `python scripts/validate_avro.py` before changing schema definitions.
- Stick to backward-compatible changes: add optional fields with defaults or new enum aliases; avoid removing fields.
- Consider integrating Schema Registry compatibility checks in CI for extra safety.

## 2. Database schema (Postgres + PostGIS)
Core schema created by [`database/migrations/001_init.sql`](../database/migrations/001_init.sql):

- `user_accounts` / `user_roles` — authentication, RBAC scaffolding.
- `alerts` — stored NOAA alerts with geometry and timestamps.
- `alert_subscriptions` — subscriber polygons and metadata.
- `user_preferences` — channel, severity, and quiet-hour configuration.
- `sms_dispatch_logs` — dispatch payloads and status responses for SMS.
- `notification_outcomes` — cross-channel delivery audit entries.

### Spatial data considerations
- PostGIS provides geometry functions for polygon matching. Use `geometry(Polygon, 4326)` types for subscription shapes and ensure NOAA alerts are normalized into the same SRID.
- When writing custom queries, prefer prepared statements with `ST_Intersects` or `ST_Contains` for spatial joins.

### Migrations workflow
1. Edit or append SQL files in `database/migrations`.
2. Rebuild the Postgres container or apply via Flyway/Liquibase in higher environments.
3. Keep migrations idempotent and ordered lexicographically (e.g., `002_add_outcomes.sql`).

## 3. Object storage & caching
- Redis (`redis://redis:6379`) is provisioned for caching or dedupe strategies. No structures are defined yet; treat it as optional infrastructure.
- Long-term archival of raw alerts can be implemented through Kafka Connect or separate pipelines as needed.

## 4. Data retention & replay
- Leverage Kafka log retention policies on alert topics to support backfills.
- Consider adding compacted topics for user preference snapshots to simplify consumer state reconstruction.
- Dead-letter queues (`dlq.*`) should be consumed by operational tooling capable of triage and replay into the primary topics.

## 5. Testing data contracts
- Use the Avro validator locally and optionally add JSON schema tests when mocking payloads in unit tests.
- Add integration tests in service directories to serialize/deserialize sample payloads against `schemas/avro` whenever new fields are introduced.

## 6. Observability metrics
- Channel workers expose delivery outcomes through Kafka and Postgres tables; aggregate them in `admin-service` or external BI tools.
- Add future metrics exports through Prometheus endpoints or OpenTelemetry exporters to capture throughput and failure rates.
