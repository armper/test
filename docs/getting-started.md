# Quickstart

This guide walks you through installing prerequisites, launching the Weather Alerts stack, and exploring the core experiences. Expect 10–15 minutes from clone to dashboard.

## 1. Before you begin
- Docker Engine 24+ with the Compose plugin (`docker compose`)
- Python 3.11+ and `pip`
- Java 17+ and Maven 3.9+
- Node.js 18+ and npm
- (Optional) GNU Make if you script your own shortcuts

## 2. Clone the repository
```bash
git clone <your fork>
cd weather-alerts-enterprise
```
Copy any provided `.env.example` into real `.env` files before running services if you plan to supply custom secrets or third-party credentials.

## 3. Launch the full stack
```bash
docker compose up --build
```
The first build caches dependencies for Python, Java, and Node services. When everything settles, you should see containers for Kafka, Schema Registry, Postgres/PostGIS, Redis, all application services, and the frontend.

### Helpful flags
- `--detach` runs containers in the background.
- `--remove-orphans` cleans up containers from previous runs.
- `--profile <name>` will let you target subsets of services once profiles are defined.

## 4. Explore the experience
1. Open the dashboard at `http://localhost:3000` and sign in with `admin / admin123` (or register a new account at `/register`).
2. Visit the **Areas** page to draw or import polygons for your test regions.
3. Monitor `docker compose logs -f alerts-normalizer-svc` to watch NOAA alerts flow in real time.
4. Review matched alerts and notification outcomes in the dashboard or via Kafka UI (`http://localhost:8085`).

## 5. Develop individual services
### Python & Faust workers
```bash
cd services/alerts-normalizer-svc
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8006
faust -A app.stream worker -l info  # run streaming pipeline
```
Set `DATABASE_URI`, `KAFKA_BROKER`, and `SCHEMA_REGISTRY_URL` to point at your running containers when operating outside Docker.

### Spring Boot services
```bash
cd services/java/user-service
./mvnw spring-boot:run
```
Use `SPRING_PROFILES_ACTIVE=local` for developer-friendly settings. Maven wrapper scripts (`./mvnw`) download dependencies automatically.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Create `.env.local` with `VITE_API_BASE_URL=http://localhost:8001` (or your gateway) to direct API calls during development.

## 6. Validate schemas before committing
```bash
python scripts/validate_avro.py schemas/avro
```
Add the command to pre-commit hooks or CI to keep Avro contracts consistent.

## 7. Troubleshooting tips
- **Containers restarting?** Check logs with `docker compose logs <service>`—missing environment variables are the most common culprit.
- **DB feels stale?** Remove the Postgres volume: `docker volume rm weather-alerts-enterprise_postgres-data` (only if you are okay losing local data).
- **Kafka topic missing?** Create it through Kafka UI or `kafka-topics.sh` inside the broker container.
- **Schema validation failing?** Increment Avro versions, keep changes backward compatible, and rerun the validator.

## 8. Next steps
- Follow the [Send Your First Alert tutorial](tutorials/first-alert.md) for an end-to-end walkthrough.
- Dig into [Architecture](architecture.md) and [Service Reference](services.md) for deeper operational detail.
- Review [Data & Schemas](data-and-schemas.md) to understand contracts powering the pipeline.
