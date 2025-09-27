from fastapi import FastAPI

from .config import settings

app = FastAPI(title="Alerts Matcher Service", version="0.2.0")


@app.get("/healthz")
async def healthcheck() -> dict:
    return {
        "status": "ok",
        "service": settings.service_name,
    }
