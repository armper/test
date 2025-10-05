import asyncio
from fastapi import FastAPI

from .config import settings

app = FastAPI(
    title="Alerts Normalizer Service",
    description=(
        "Ingests raw NOAA CAP feeds, normalizes payloads, and publishes canonical alert "
        "records for downstream processing."
    ),
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Weather Alerts Platform",
        "email": "devops@weatheralerts.example",
    },
    license_info={
        "name": "Apache 2.0",
        "url": "https://www.apache.org/licenses/LICENSE-2.0.html",
    },
)


async def _noop_loop() -> None:
    while True:
        await asyncio.sleep(settings.fetch_interval_seconds)


@app.on_event("startup")
async def startup_event() -> None:
    app.state.loop_task = asyncio.create_task(_noop_loop())


@app.on_event("shutdown")
async def shutdown_event() -> None:
    task = getattr(app.state, "loop_task", None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:  # pragma: no cover
            pass


@app.get("/healthz")
async def healthcheck() -> dict:
    return {
        "status": "ok",
        "service": settings.service_name,
    }
