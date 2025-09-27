# System Architecture

## Overview
The enterprise refactor introduces a hybrid Python/Spring Boot platform centered on Apache Kafka with Schema Registry. Postgres + PostGIS remains the single source of truth for users, polygons, alert records, and notification outcomes. Events flow through Kafka topics with Avro schemas and idempotent producers.

## Services

### Python / Faust Workers
- **alerts-normalizer-svc** – Periodically hits `api.weather.gov`, persists raw features, and publishes both raw and normalized alerts (`noaa.alerts.*` topics).
- **alerts-matcher-svc** – Subscribes to normalized alerts, queries PostGIS using `ST_Intersects`, emits user matches, and prepares dispatch requests.
- **map-service** – FastAPI CRUD for user polygons (GeoJSON) and catalog metadata. Writes to PostGIS.
- **email-worker** – Kafka consumer placeholder for SES/SendGrid. Emits outcomes to `notify.outcome.v1`.
- **push-worker** – Mock FCM/APNs sender; same outcome semantics.

### Spring Boot Services
- **notification-router-service** – Stateless Kafka router. Applies quiet hours, severity filters, and channel preferences before fanning out to `notify.{email,push,sms}.request.v1`. Uses transactional producers.
- **sms-worker-service** – Mock Twilio integration persisting dispatch logs and writing status outcomes.
- **user-service** – OAuth2/JWT-capable auth, RBAC, and preference management. Exposes REST APIs and integrates with Kafka for downstream events.
- **admin-service** – Dashboards summarizing Postgres metrics; extend to incorporate Kafka outcome streams.

## Kafka Backbone
- Topics enumerated in `schemas/avro`. Each has BACKWARD-compatible Avro schema.
- Producers key records on `user_id` to guarantee ordering per subscriber.
- `notify.dispatch.request.v1` is the contract between matcher and router; router fans out to channel-specific topics and writes DLQs when dispatch fails.
- Schema Registry (Confluent compatible) enforces compatibility during CI via `fastavro` validation (extend to SR compatibility checks in future).

## Data Stores
- Single `weather` Postgres database with PostGIS extension. Tables defined in `database/migrations/001_init.sql`.
- Redis reserved for ephemeral caching/extensions (future use).

## Security & Auth
- Spring Security (user-service) issues/validates JWTs. Endpoints honor role-based access (user/admin).
- Service-to-service auth assumed via network policies and Kafka ACLs (configure in production).

## Deployment
- Docker Compose spins up Kafka, Schema Registry, Kafka UI, Postgres/PostGIS, Redis, and all services for local dev.
- Helm chart (`infrastructure/k8s/helm/weather-alerts`) seeds Kubernetes manifests; extend with secrets, Ingress, and autoscaling.

## Event Flow Summary
1. `alerts-normalizer-svc` fetches NOAA alerts and publishes normalized Avro records.
2. `alerts-matcher-svc` reads normalized alerts, intersects polygons in PostGIS, and emits user-specific matches + dispatch requests.
3. `notification-router-service` evaluates preferences, quiet hours, and severity to route events into channel request topics.
4. Channel workers (email/push/sms) execute delivery (mocked for SMS/push/email in dev) and write outcomes to Kafka + Postgres.
5. Downstream analytics (admin-service, Kafka UI) consume `notify.outcome.v1` for dashboards and auditing.
