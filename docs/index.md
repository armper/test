---
title: Weather Alerts Enterprise Platform
description: Hybrid NOAA alert ingestion, spatial matching, and multi-channel notification platform.
---

# Weather Alerts Enterprise Platform

Hybrid Python + Spring Boot platform for ingesting NOAA weather alerts, running spatial matches, and distributing notifications across email, push, and SMS channels. Explore the docs below to get productive quickly.

## Quick links
- [Getting Started](getting-started.md)
- [Architecture Deep Dive](architecture.md)
- [Service Reference](services.md)
- [Data & Schemas](data-and-schemas.md)
- [API Specs](api/index.md)
- [Custom Condition Alerts](custom-condition-alerts.md)

## What you get
- **Ingestion pipeline:** `alerts-normalizer-svc` fetches NOAA alerts, normalizes them, and publishes Avro messages to Kafka.
- **Spatial matching:** `alerts-matcher-svc` intersects alerts with subscriber polygons stored in PostGIS.
- **Preference-aware routing:** `notification-router-service` evaluates user preferences, quiet hours, and severity levels before dispatching.
- **Channel outcomes:** Mock workers mirror delivery success/failure to Kafka and Postgres for auditing and dashboards.
- **Frontend experience:** React + Vite single-page app for subscribers and admins.

## Quick start
```bash
docker compose up --build
```
Docker Compose provisions Kafka, Schema Registry, Kafka UI, Postgres/PostGIS, Redis, and every microservice. Visit Kafka UI at `http://localhost:8085` to monitor topics and `http://localhost:8003/docs` for polygon APIs.

Need finer-grained workflows? Head over to [Getting Started](getting-started.md) for individual service tips, schema validation, and troubleshooting.

## Architecture snapshot
```
NOAA API → alerts-normalizer-svc → alerts-matcher-svc → notification-router-service → channel workers
                        ↘ Postgres/PostGIS ↖ user-service / admin-service / frontend
```
Read the [Architecture Deep Dive](architecture.md) for component breakdowns, deployment options, and extensibility roadmap.

## Publish to GitHub Pages
1. Commit the `/docs` directory and push to `main`.
2. In your GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` as the branch and `/docs` as the folder, then save.
5. GitHub Pages will build the site using the bundled Jekyll theme. Share the generated URL with your team.

To customize the theme or navigation, edit [`docs/_config.yml`](./_config.yml) or add additional Markdown files under `docs/`—they appear automatically in the published site.

## Further exploration
- Extend channel workers with real provider integrations (Twilio, SendGrid, FCM).
- Add OpenTelemetry tracing and expose Prometheus metrics for observability.
- Integrate schema compatibility checks into CI/CD for safer Avro evolution.

Questions or contributions? Open an issue or start a discussion—documentation updates are welcome!
