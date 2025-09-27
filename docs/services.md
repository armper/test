# Service Reference

A quick reference for the microservices and workers that make up the platform. Use it to discover ports, dependencies, and operational notes.

## Python (FastAPI + Faust)

### alerts-normalizer-svc
- **Purpose:** Polls `api.weather.gov`, stores raw feeds, normalizes alerts, and publishes them to Kafka.
- **Tech:** FastAPI for admin endpoints, Faust for streaming.
- **Ports:** `8006` (HTTP, health + admin).
- **Dependencies:** Kafka (`KAFKA_BROKER`), Schema Registry (`SCHEMA_REGISTRY_URL`).
- **Key topics:** `noaa.alerts.raw.v1`, `noaa.alerts.normalized.v1`.

### alerts-matcher-svc
- **Purpose:** Consumes normalized alerts and runs spatial joins against user polygons.
- **Tech:** FastAPI + Faust with PostGIS queries via SQLAlchemy.
- **Ports:** `8007`.
- **Dependencies:** Kafka, Schema Registry, Postgres/PostGIS.
- **Key topics:** `alerts.matches.user.v1`, `notify.dispatch.request.v1`.

### map-service
- **Purpose:** REST CRUD for user polygons and metadata.
- **Tech:** FastAPI with Pydantic models.
- **Ports:** `8003`.
- **Dependencies:** Postgres/PostGIS (`MAP_SERVICE_DATABASE_URI`).
- **Notes:** OpenAPI docs at `/docs`.

### email-worker & push-worker
- **Purpose:** Mock channel delivery workers for email and push notifications.
- **Tech:** Faust workers with Kafka consumers.
- **Dependencies:** Kafka (`KAFKA_BROKER`), Schema Registry if using Avro serialization.
- **Notes:** Mirror delivery outcomes to `notify.outcome.v1`.

## Spring Boot services (`services/java`)

### notification-router-service
- **Purpose:** Applies user preferences, quiet hours, and severity thresholds before fanning out to channel-specific Kafka topics.
- **Ports:** `8080` inside container (`8100` host).
- **Dependencies:** Kafka (`KAFKA_BROKER`), Schema Registry client (if configured).
- **Key topics:** Consumes `notify.dispatch.request.v1`, produces `notify.{email,push,sms}.request.v1` and DLQs.

### sms-worker-service
- **Purpose:** Mock Twilio implementation persisting SMS dispatch logs and mirror outcomes.
- **Ports:** `8080` container (`8101` host).
- **Dependencies:** Kafka (`KAFKA_BROKER`), Postgres (`DATABASE_URI`).
- **Notes:** Swap the mock integration with real Twilio credentials for production.

### user-service
- **Purpose:** OAuth2-ready authentication and preference management.
- **Ports:** `8080` container (`8001` host).
- **Dependencies:** Postgres credentials, Kafka broker for event hooks.
- **Notes:** Exposes `/actuator/health` and JWT endpoints once secrets are configured.

### admin-service
- **Purpose:** Operational dashboards for metrics sourced from Postgres and Kafka outcomes.
- **Ports:** `8080` container (`8005` host).
- **Dependencies:** Postgres.

## Frontend (`frontend`)
- **Purpose:** React + Vite SPA for subscriber and admin interactions.
- **Ports:** `5173` via `npm run dev`; production build served from container.
- **Dependencies:** User Service for auth, Map Service APIs, Admin data sources.
- **Notes:** Configure base API URL through `VITE_API_BASE_URL`.

## Observability & Tooling
- **Kafka UI:** Web dashboard for topics and consumer lag at `http://localhost:8085`.
- **Schema Registry:** Exposed at `http://localhost:9081` for Avro compatibility checks.
- **Redis:** Placeholder for caching and rate limiting (`redis://localhost:6379`).

## Health & Diagnostics
- Enable DEBUG-level logs via service-specific environment variables (`LOG_LEVEL`, `SPRING_PROFILES_ACTIVE=dev`, etc.).
- Health checks follow `/healthz` for Python services and `/actuator/health` for Spring Boot services.
- Review container logs with `docker compose logs -f <service>` when debugging message flow or delivery outcomes.
