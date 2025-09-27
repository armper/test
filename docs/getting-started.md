# Getting Started

This guide walks through running the Weather Alerts Enterprise Platform locally, validating services, and iterating on specific components.

## 1. Prerequisites
- Docker Engine 24+ with the Compose plugin (`docker compose`)
- Python 3.11+ and `pip`
- Java 17+ and Maven (3.9+) for Spring Boot services
- Node.js 18+ and npm for the React frontend
- GNU Make (optional) if you use your own automation wrappers

## 2. Clone and bootstrap
```bash
git clone <your fork>
cd weather-alerts-enterprise
```
If you rely on `.env` files for secrets (JWT signing keys, OAuth client IDs, provider credentials) copy the sample or create them inside the relevant service directories before starting containers.

## 3. Run everything with Docker Compose
```bash
docker compose up --build
```
Compose builds application images, applies database migrations via `database/migrations`, and exposes services on localhost. The initial build fetches Maven and npm dependencies; subsequent runs leverage cached layers.

### Helpful flags
- `--detach` keeps containers running in the background.
- `--profile frontend` (coming soon) lets you selectively start groups of services when profiles are defined.
- `--remove-orphans` cleans up containers from older runs if you have renamed services.

## 4. Verify local services
| Component | Health check | Notes |
| --- | --- | --- |
| Kafka UI | `http://localhost:8085` | Inspect topics, schemas, and consumer groups |
| Alerts Normalizer | `http://localhost:8006/healthz` | Schedules NOAA ingestion; expect CRON-style fetches |
| Alerts Matcher | `http://localhost:8007/healthz` | Requires Postgres populated with polygons |
| Map Service | `http://localhost:8003/docs` | FastAPI docs with polygon CRUD operations |
| User Service | `http://localhost:8001/actuator/health` | Spring Boot actuator; add OAuth secrets via `.env` |
| Admin Service | `http://localhost:8005/actuator/health` | Dashboards surface DB metrics |
| Notification Router | `http://localhost:8100/actuator/health` | Kafka consumer/producer for dispatching |
| SMS Worker | `http://localhost:8101/actuator/health` | Mock Twilio implementation |
| Frontend | `http://localhost:5173` (when `npm run dev`) | Vite dev server for SPA |

## 5. Developing individual services
### Python / Faust services
```bash
cd services/alerts-normalizer-svc
pip install -r requirements.txt
faust -A app.stream worker -l info
```
Point `DATABASE_URI`, `KAFKA_BROKER`, and `SCHEMA_REGISTRY_URL` at your running containers. Use `uvicorn app.main:app --reload --port 8006` to iterate on FastAPI endpoints.

### Spring Boot services
```bash
cd services/java/user-service
./mvnw spring-boot:run
```
Set `SPRING_PROFILES_ACTIVE` to `local` or `docker` and export JDBC/Kafka connection strings to match your environment. Application logs stream to the console and actuator endpoints expose readiness.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Configure `VITE_API_BASE_URL` via `.env.local` to point at whichever gateway or service you are exercising.

## 6. Validate schemas
Use the provided helper to lint Avro definitions before publishing schema changes:
```bash
python scripts/validate_avro.py
```
Integrate the command into your pre-commit hooks or CI pipeline for consistency.

## 7. Common troubleshooting
- **Containers restart repeatedly:** run `docker compose logs <service>` to identify configuration gaps (e.g., missing environment variables).
- **Database migrations not applied:** ensure the `database/migrations` volume is mounted and remove the `postgres-data` volume when you need a clean slate (`docker volume rm weather-alerts-enterprise_postgres-data`).
- **Kafka topic missing:** topics default to manual creation. Use Kafka UI or `kafka-topics.sh` inside the broker container to create missing topics.
- **Schema validation failures:** bump Avro versions and keep changes backward compatible; the validator enforces logical type correctness but not registry compatibility yet.

## 8. Cleaning up
```bash
docker compose down --volumes
```
Removes containers and persisted volumes (including Postgres data). Drop `--volumes` if you want to keep local data between runs.

## 9. Next steps
- Deep dive into the architecture in [`docs/architecture.md`](architecture.md).
- Review service-specific details in [`docs/services.md`](services.md).
- Explore data contracts in [`docs/data-and-schemas.md`](data-and-schemas.md).
