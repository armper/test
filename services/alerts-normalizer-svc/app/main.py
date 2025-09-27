from fastapi import FastAPI

from .config import settings
from .stream import ensure_topics

app = FastAPI(title="Alerts Normalizer Service", version="0.2.0")


@app.on_event("startup")
async def startup_event() -> None:
    await ensure_topics()


@app.get("/healthz")
async def healthcheck() -> dict:
    return {
        "status": "ok",
        "service": settings.service_name,
    }
