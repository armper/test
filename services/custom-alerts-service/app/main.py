from fastapi import FastAPI

from . import db
from .config import settings
from .routes import router
from .metrics import router as metrics_router
from .scheduler import ConditionScheduler

app = FastAPI(
    title="Custom Condition Alerts Service",
    description=(
        "Manages user-defined weather condition subscriptions and triggers downstream "
        "notifications when thresholds are met."
    ),
    version="0.1.0",
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
scheduler = ConditionScheduler()


@app.on_event("startup")
async def on_startup() -> None:
    db.Base.metadata.create_all(bind=db.engine)
    if settings.enable_scheduler:
        await scheduler.start()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if settings.enable_scheduler:
        await scheduler.stop()


@app.get("/healthz")
async def healthcheck() -> dict:
    return {"status": "ok"}


app.include_router(router)
app.include_router(metrics_router)
