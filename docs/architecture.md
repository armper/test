# System Architecture

## Overview
The platform ingests NOAA alerts, normalizes and enriches them, runs spatial matching, and delivers tailored notifications across email, push, and SMS channels. Python/Faust services handle event ingestion and matching, while Spring Boot services own orchestration, preferences, and administrative workflows. Kafka with Schema Registry provides the event backbone; Postgres/PostGIS stores persistent state.

```
NOAA API → alerts-normalizer-svc → alerts-matcher-svc → notification-router-service → channel workers → end users
                               ↘ Postgres/PostGIS (polygons, preferences, audit)
```

## Component topology
### Ingestion & normalization
- `alerts-normalizer-svc` polls `api.weather.gov`, stores a raw copy of each alert and emits normalized Avro messages.
- Fault tolerance is handled by Kafka retention, enabling replay when downstream services are unavailable.

### Spatial matching & dispatch requests
- `alerts-matcher-svc` consumes normalized alerts and executes `ST_Intersects` joins against subscriber polygons in PostGIS.
- Matches are emitted on `alerts.matches.user.v1` for analytics and `notify.dispatch.request.v1` for dispatch orchestration.

### Preference-aware routing
- `notification-router-service` consumes dispatch requests, evaluates quiet hours, severity preferences, and channel opt-ins, then publishes to `notify.{email,push,sms}.request.v1`.
- Dead-letter queues (`dlq.*`) capture failures for replay.

### Channel workers
- `email-worker`, `push-worker`, and `sms-worker-service` deliver channel-specific messages (mock implementations in development) and emit `notify.outcome.v1` records along with Postgres audit entries.
- Replace channel workers with production-grade provider integrations by reusing the topic contracts.

### User-facing APIs and dashboards
- `user-service` provides OAuth2/JWT auth, profile management, and preference APIs.
- `map-service` exposes polygon CRUD endpoints for subscribers.
- `admin-service` surfaces operational dashboards backed by Postgres and Kafka outcomes.
- `frontend` (React + Vite) interacts with these APIs and can be deployed independently or behind a gateway.

## Event flow summary
1. `alerts-normalizer-svc` fetches NOAA alerts on a schedule, writes raw payloads, and emits normalized Avro events.
2. `alerts-matcher-svc` pulls normalized alerts, resolves affected subscribers using PostGIS polygons, and emits match events plus dispatch requests.
3. `notification-router-service` reads dispatch requests, enforces preference logic, and fans out to channel-specific Kafka topics.
4. Channel workers consume their respective topics, simulate delivery, and write `notify.outcome.v1` events.
5. Outcomes feed `admin-service` dashboards and persist to Postgres for auditing.
6. Operators monitor Kafka UI, Schema Registry, and logs to maintain healthy message flow.

## Data stores & contracts
- **Postgres/PostGIS:** canonical storage for users, polygons, preferences, and notification outcomes. See [`docs/data-and-schemas.md`](data-and-schemas.md).
- **Kafka:** event backbone with Avro schemas stored in [`schemas/avro`](../schemas/avro). Producers use keyed, idempotent transactions to guarantee ordering per subscriber.
- **Redis:** optional cache for future work (rate limiting, dedupe, session storage).

## Security & access control
- `user-service` issues JWTs via Spring Security; propagate tokens to frontends and downstream services.
- Production deployments should configure Kafka ACLs, TLS, and secret management (Vault, AWS Secrets Manager, etc.).
- Network policy and service mesh layers (e.g., Istio) can enforce zero-trust communication between services.

## Deployment topologies
- **Local development:** Docker Compose orchestrates dependencies and app containers. Ideal for testing end-to-end flows.
- **Kubernetes:** Helm chart (`infrastructure/k8s/helm/weather-alerts`) supplies Deployments, Services, and ConfigMaps. Extend it with Ingress, HorizontalPodAutoscaler, and Prometheus `ServiceMonitor` resources.
- **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`) builds language-specific artifacts, validates Avro schemas, and exercises container builds. Integrate with GitOps tools (Argo CD, Flux) for continuous delivery.

## Extensibility roadmap
- Swap mock channel workers with production providers (Twilio, SendGrid, FCM).
- Introduce OpenTelemetry tracing across Python and Spring Boot services, exporting to Prometheus/Grafana/Tempo.
- Enhance analytics by pushing `notify.outcome.v1` into data warehouses (BigQuery, Snowflake) for retention and BI.
- Add backpressure monitoring and auto-scaling policies based on Kafka lag metrics.
