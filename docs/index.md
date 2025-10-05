---
title: Weather Alerts Enterprise Platform
description: Guided documentation for running, exploring, and extending the Weather Alerts stack.
---

# Welcome

This site helps you get productive with the Weather Alerts Enterprise Platform. Whether you want to run the full stack in minutes, explore individual services, or extend the system for your own alerting needs, start here.

## Choose your path
- **Just getting started?** Follow the [Quickstart](getting-started.md) to install prerequisites and launch the stack with Docker Compose.
- **Prefer a hands-on tour?** Walk through the [Send Your First Alert tutorial](tutorials/first-alert.md) to experience the full alert lifecycle end to end.
- **Need context?** Jump to the [Architecture overview](architecture.md) or [Service reference](services.md) for deeper dives.

## What you can do here
- Launch a local NOAA ingest, spatial matching, and notification environment in under ten minutes.
- Inspect Avro schemas, Kafka topics, and Postgres data to understand the pipeline.
- Iterate on individual Python, Java, or React services with the provided dev workflows.
- Customize routing logic, notification channels, and frontend experiences.

## Quick reference
```bash
docker compose up --build  # start Kafka, Postgres, all services, and the frontend
docker compose logs -f alerts-normalizer-svc  # follow ingestion activity
python scripts/validate_avro.py schemas/avro  # lint schema changes before pushing
```

### Key local URLs
- Dashboard: `http://localhost:3000`
- Alerts APIs: `http://localhost:8006/healthz`, `http://localhost:8007/healthz`, `http://localhost:8003/docs`
- Spring Boot endpoints: `http://localhost:8001/actuator/health`, `http://localhost:8100/actuator/health`
- Kafka UI: `http://localhost:8085`

## Share the docs
Publishing on GitHub Pages takes only a few clicks:
1. Commit the `/docs` folder and push to `main`.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` and `/docs`, then save—GitHub Pages will rebuild automatically.

Customize navigation or theming by editing [`docs/_config.yml`](./_config.yml) or adding new Markdown files. Subdirectories are included automatically when linked.

## Stay in touch
Open an issue or start a discussion if you see something missing. Tutorials, troubleshooting tips, and real-world integration examples are especially welcome.
