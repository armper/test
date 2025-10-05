# Weather Alerts Enterprise Platform

A user-friendly launchpad for experimenting with NOAA weather alerts, spatial matching, and multi-channel notifications. Spin it up locally, explore the prebuilt dashboards, and extend the services to fit your workflows.

## Why teams use this platform
- **Ingest NOAA alerts automatically:** `alerts-normalizer-svc` pulls feeds from `api.weather.gov`, normalizes records, and publishes Avro events.
- **Match alerts to users in real time:** `alerts-matcher-svc` intersects alerts with PostGIS polygons to determine which subscribers should be notified.
- **Respect preferences and quiet hours:** `notification-router-service` evaluates severity rules, quiet windows, and channel preferences before dispatching.
- **Deliver across channels:** Mock email, push, and SMS workers demonstrate downstream fan-out and mirror delivery outcomes for auditing.
- **Front-end visibility:** A React dashboard lets you manage regions, preview alerts, and review notification history without touching the CLI.

## Start in minutes
1. Clone the repository and switch into the project directory.
   ```bash
   git clone <your-fork>
   cd weather-alerts-enterprise
   ```
2. (Optional) Copy `.env.example` files in each service directory and fill in secrets such as JWT keys or third-party API credentials.
3. Launch the full stack with Docker Compose.
   ```bash
   docker compose up --build
   ```
   - Frontend dashboard: `http://localhost:3000` (or `http://localhost:5173` via `npm run dev`)
   - Kafka UI: `http://localhost:8085`
   - Map Service docs: `http://localhost:8003/docs`
   - Health probes: FastAPI services expose `/healthz`; Spring Boot services use `/actuator/health`
4. Log in with the sample admin account (`admin / admin123`) or register a new end user via `http://localhost:3000/register`.

## Take the guided tour
Ready to see an alert flow from ingestion to delivery? Follow the step-by-step tutorial in [`docs/tutorials/first-alert.md`](docs/tutorials/first-alert.md). You will:
- Import demo polygons for a region
- Trigger NOAA alerts (or replay fixtures) and watch them propagate through Kafka
- Verify notification outcomes in the dashboard and database

## Explore the apps
- **FastAPI + Faust services (`services/alerts-normalizer-svc`, `services/alerts-matcher-svc`, `services/custom-alerts-service`):** Manage ingestion pipelines and custom condition rules.
- **Spring Boot services (`services/java`)** provide authentication, routing, SMS handling, and admin dashboards.
- **Frontend (`frontend`)** offers a Vite-powered React SPA with authentication, map editing, and alert monitoring.
- **Data & tooling (`database`, `schemas/avro`, `scripts`)** centralize migrations, Avro schemas, and helper scripts like `validate_avro.py`.

## Project map
| Path | Description |
| --- | --- |
| `services/` | Source for Python and Java microservices plus Kafka workers |
| `frontend/` | React/TypeScript single-page app and UI assets |
| `database/` | Postgres/PostGIS migrations and seed data |
| `schemas/avro/` | Avro schema definitions validated in CI |
| `docs/` | GitHub Pages content, tutorials, and architecture notes |
| `scripts/` | Utilities for schema validation and developer tooling |

## Development shortcuts
- Python services: `pip install -r requirements.txt && pytest`
- Java services: `./mvnw spring-boot:run` for development, `mvn test` for suites
- Frontend: `npm install && npm run dev` for hot reload, `npm run test` for Vitest
- Schema validation: `python scripts/validate_avro.py schemas/avro`

## Documentation & support
- Start with [`docs/index.md`](docs/index.md) (rendered automatically on GitHub Pages) for architecture highlights and navigation.
- Deep dives: [`docs/architecture.md`](docs/architecture.md), [`docs/services.md`](docs/services.md), [`docs/data-and-schemas.md`](docs/data-and-schemas.md).
- Troubleshooting and onboarding guides live throughout the `/docs` folder.

## Contributing
See [`AGENTS.md`](AGENTS.md) for contributor guidelines, coding conventions, and pull request expectations. Updates to docs, tutorials, and developer tooling are always welcome.
