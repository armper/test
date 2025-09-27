# Weather Alerts Enterprise Platform

Hybrid Python + Spring Boot microservices delivering NOAA (api.weather.gov) alerts with Kafka as the event backbone, Postgres + PostGIS as source of truth, and channel workers for email, push, and mock SMS.

## Service Inventory

### Python (FastAPI + Faust)
- **alerts-normalizer-svc** – Scheduled NOAA ingestion, normalization, and publication to `noaa.alerts.*` Kafka topics.
- **alerts-matcher-svc** – Consumes normalized alerts, executes PostGIS `ST_Intersects` against user polygons, emits matches to downstream topics.
- **map-service** – GeoJSON polygon CRUD backed by PostGIS for alert subscriptions.
- **push-worker** – Consumes `notify.push.request.v1`, mocks FCM/APNs fan-out, mirrors outcomes to Kafka.
- **email-worker** – Consumes `notify.email.request.v1`, placeholder SendGrid/SES integration.

### Spring Boot
- **notification-router-service** – Kafka consumer/producer applying user preferences, quiet hours, severity filters; routes to channel topics with idempotent transactions.
- **sms-worker-service** – Mock Twilio worker persisting SMS logs to Postgres and emitting outcomes.
- **user-service** – OAuth2-ready auth service with Spring Security, JWT scaffolding, role management, and Kafka connectivity hooks.
- **admin-service** – Simple dashboard surfacing Postgres metrics; extend to query Kafka outcomes.

All services interoperate via Kafka (with Schema Registry) and shared Postgres schemas defined in `database/migrations/001_init.sql`.

## Kafka Contracts

Avro schemas for every topic live in `schemas/avro/`. The CI pipeline runs `scripts/validate_avro.py` to enforce compatibility. Primary topics:

- `noaa.alerts.raw.v1`
- `noaa.alerts.normalized.v1`
- `alerts.matches.user.v1`
- `notify.dispatch.request.v1`
- `notify.email.request.v1`
- `notify.push.request.v1`
- `notify.sms.request.v1`
- `notify.outcome.v1`
- Dead-letter topics `dlq.*` (configure in broker).

Producers default to a per-user key and enable idempotence/transactions.

## Local Development (Docker Compose)

The new `docker-compose.yml` provisions Kafka, Schema Registry, Kafka UI, Postgres/PostGIS, Redis, and all hybrid services.

```bash
docker compose up --build
```

Key endpoints:

- Kafka bootstrap (external): `localhost:19092`
- Schema Registry: `http://localhost:9081`
- Kafka UI: `http://localhost:8085`
- Postgres: `postgres://weather:weather@localhost:5432/weather`
- alerts-normalizer health: `http://localhost:8006/healthz`
- alerts-matcher health: `http://localhost:8007/healthz`
- Spring Boot apps on ports `8001` (user), `8005` (admin), `8100` (router), `8101` (sms)
- Map service: `http://localhost:8003`

Use `.env` files per service to supply secrets (JWT signing keys, provider credentials). Twilio/SMS is mocked; swapping to real Twilio requires wiring credentials into `sms-worker-service`.

## Kubernetes (Helm)

`infrastructure/k8s/helm/weather-alerts` contains a starter Helm chart with deployments for core workloads. Tune `values.yaml` to point at your Kafka and Postgres endpoints, adjust replica counts, and extend with Ingress/ServiceMonitor definitions as needed.

## CI/CD

`.github/workflows/ci.yml` builds Python services, Maven projects, validates Avro schemas, and exercises container builds. Extend the workflow with schema compatibility gates (e.g., Confluent SR checks) and deployment automation (Argo CD, Flux, etc.).

## Database Migrations

`database/migrations/001_init.sql` bootstraps:

- `user_accounts`, `user_roles`
- `alerts`, `alert_subscriptions`
- `user_preferences`
- `sms_dispatch_logs`, `notification_outcomes`

Apply via `psql` or migration tooling before deploying services.

## Development Tips

- Faust-based services (`alerts-normalizer-svc`, `alerts-matcher-svc`, workers) use `faust-streaming`. Run locally with `faust -A app.stream worker -l info` for stream processors.
- Spring Boot services expose `/actuator/health` by default; use `SPRING_PROFILES_ACTIVE` to toggle config for docker vs. kubernetes.
- Use the Kafka UI to monitor topic offsets and ensure idempotent producers transact as expected.
- Schema evolution must remain backward compatible—update Avro files and bump topic schema versions accordingly.

## Roadmap

- Replace SMS mock with real Twilio integration and secrets management.
- Instrument services with OpenTelemetry, pushing traces to Prometheus/Grafana/Tempo stack.
- Expand admin-service to surface real-time Kafka metrics (KSQL/ksqlDB or interactive queries).
- Harden auth with OAuth2 providers and propagate JWT to downstream services for channel filtering.
