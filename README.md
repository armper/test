# Weather Alerts Enterprise Platform

Modern weather-alert distribution platform composed of Python (FastAPI + Faust) and Spring Boot microservices, Kafka for event streaming, and Postgres/PostGIS as the system of record. The stack delivers NOAA (api.weather.gov) alert ingestion, matching, and multi-channel notification fan-out.

- **Docs:** start with [`docs/index.md`](docs/index.md) or the GitHub Pages site published from `/docs`.
- **Quick start:** `docker compose up --build` brings up brokers, data stores, and every service for local experimentation.
- **Services:** alerts ingestion and matching, user-facing APIs, mock notification workers for push, email, and SMS.

---

## Platform Highlights
- End-to-end NOAA alert lifecycle: ingestion → spatial matching → preference-aware routing → channel delivery.
- Kafka + Schema Registry enforce Avro contracts and transactional, keyed producers for per-user ordering.
- Shared Postgres/PostGIS database captures polygons, preferences, and notification audit trails.
- Extensible worker model for integrating real email, push, or SMS providers.
- Deployment ready for local Docker Compose and Kubernetes Helm-based rollouts.

## Repository Layout
| Path | What lives here |
| --- | --- |
| `services/alerts-normalizer-svc`, `services/alerts-matcher-svc`, `services/map-service` | Python/Faust ingestion, matching, and polygon APIs |
| `services/workers/{email-worker,push-worker}` | Kafka channel workers for email and push notifications |
| `services/java/{notification-router-service,sms-worker-service,user-service,admin-service}` | Spring Boot services for orchestration, SMS, auth, and admin dashboards |
| `frontend/` | React + Vite SPA for end-user and admin dashboards |
| `database/` | Postgres/PostGIS migrations and seed data |
| `schemas/avro/` | Avro schema definitions for every Kafka topic |
| `infrastructure/k8s/helm/weather-alerts/` | Starter Helm chart for cluster deployments |
| `docs/` | Markdown sources for the documentation site and architecture deep-dives |
| `scripts/` | Tooling such as `validate_avro.py` for schema compatibility checks |

## Getting Started

### Prerequisites
- Docker Engine 24+ with Compose plugin
- Python 3.11+ and `pip` for running scripts or FastAPI workers outside of Docker
- Java 17+ and Maven (if you need to run Spring Boot services locally)
- Node.js 18+ (for developing the frontend)

### Launch the full stack
```bash
docker compose up --build
```

Compose provisions Kafka, Schema Registry, Kafka UI, Postgres/PostGIS, Redis, the hybrid microservices, and the React frontend. Use `.env` files in each service directory to override secrets (JWT keys, provider credentials) as needed.

### Key local endpoints
- Kafka bootstrap (external): `localhost:19092`
- Schema Registry: `http://localhost:9081`
- Kafka UI: `http://localhost:8085`
- Postgres: `postgres://weather:weather@localhost:5432/weather`
- Map Service: `http://localhost:8003`
- Alerts normalizer health probe: `http://localhost:8006/healthz`
- Alerts matcher health probe: `http://localhost:8007/healthz`
- Spring Boot services: `user-service` on `8001`, `admin-service` on `8005`, `notification-router-service` on `8100`, `sms-worker-service` on `8101`
- Frontend (nginx container): `http://localhost:3000`
  - Frontend dev server (optional): run `npm run dev` in `frontend/` for hot reload at `http://localhost:5173`
  - Override API target during Docker build with `--build-arg VITE_API_BASE_URL=https://gateway.yourdomain/api`

### Authentication quick start
- Register an end-user: `POST http://localhost:8001/api/v1/auth/register` with body `{"email":"demo@example.com","password":"passw0rd"}`.
- Admin dashboard uses HTTP basic auth: `admin / admin123` at `http://localhost:8005/`.

## Services at a Glance
| Name | Stack | Role |
| --- | --- | --- |
| `alerts-normalizer-svc` | FastAPI, Faust | Scheduled NOAA ingestion and alert normalization; publishes to `noaa.alerts.*` topics |
| `alerts-matcher-svc` | FastAPI, Faust | Subscribes to normalized alerts, runs `ST_Intersects` joins against polygons, emits user matches |
| `map-service` | FastAPI | CRUD APIs for user polygons backed by PostGIS |
| `notification-router-service` | Spring Boot | Applies user preferences, quiet hours, and severity filters before routing notifications |
| `email-worker`, `push-worker`, `sms-worker-service` | Python, Spring Boot | Mock channel providers for email, push, and SMS with Kafka outcome mirroring |
| `user-service` | Spring Boot | OAuth2-ready authentication, JWT issuance, RBAC, and user preference APIs |
| `admin-service` | Spring Boot | Operational dashboard surfacing Postgres/Kafka metrics |

## Kafka & Schemas
- Avro schema sources live in `schemas/avro/` with CI validation through `scripts/validate_avro.py`.
- Core topics: `noaa.alerts.raw.v1`, `noaa.alerts.normalized.v1`, `alerts.matches.user.v1`, `notify.dispatch.request.v1`, `notify.email.request.v1`, `notify.push.request.v1`, `notify.sms.request.v1`, and `notify.outcome.v1` plus the `dlq.*` family.
- Producers key by `user_id`, enable idempotence, and wrap in transactions to keep channel fan-out consistent.

## Deployment & Operations
- **Docker Compose:** default local developer experience spinning up the entire ecosystem.
- **Kubernetes:** `infrastructure/k8s/helm/weather-alerts` contains a starter Helm chart; customize `values.yaml` for environment-specific configuration, secrets, and ingress.
- **CI/CD:** `.github/workflows/ci.yml` builds Python and Java services, validates schemas, and exercises container builds. Extend it with Schema Registry compatibility checks, security scanning, and deployment automation.

## Database & Migrations
`database/migrations/001_init.sql` provisions the Postgres schema, including `user_accounts`, `user_roles`, `alerts`, `alert_subscriptions`, `user_preferences`, `sms_dispatch_logs`, and `notification_outcomes`. Apply via `psql`, Flyway, or your preferred migration tooling before deploying to shared environments.

## Development Tips
- Faust-based services (`alerts-normalizer-svc`, `alerts-matcher-svc`, channel workers) can run locally with `faust -A app.stream worker -l info` when you need rapid iteration outside of Docker.
- Spring Boot services expose `/actuator/health` and can switch environment profiles via `SPRING_PROFILES_ACTIVE`.
- Monitor Kafka topics and consumer lag through Kafka UI (`http://localhost:8085`).
- Treat schema evolution as backward compatible; bump Avro versions and rerun validation in CI before merging.

## Testing
- Python services use pytest integration tests located under `services/*/tests`. Run `pytest` in each service directory (CI executes them automatically).
- Spring Boot services ship with JUnit integration tests leveraging H2 and embedded Kafka where required (`mvn test`).
- Frontend tests run with Vitest/Testing Library (`npm run test`).
The GitHub Actions workflow orchestrates all three suites before building container images.

## Roadmap Ideas
- Replace the mock SMS implementation with a production-grade Twilio integration.
- Add OpenTelemetry-based tracing fed into Prometheus/Grafana/Tempo or alternative observability stacks.
- Expand the admin dashboard with real-time Kafka metrics and user-level analytics.
- Integrate with external OAuth2 providers and propagate JWTs to downstream services for channel filtering.

## Further Reading
- [`docs/getting-started.md`](docs/getting-started.md) — end-to-end setup, troubleshooting tips, and service-specific workflows.
- [`docs/architecture.md`](docs/architecture.md) — deep dive into system components, data flow, and deployment topology.
- [`docs/services.md`](docs/services.md) — detailed service reference with ports, dependencies, and health checks.
- [`docs/data-and-schemas.md`](docs/data-and-schemas.md) — Avro contracts, database schema, and migration guidance.
