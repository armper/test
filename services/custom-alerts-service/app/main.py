from fastapi import FastAPI

from . import db
from .config import settings
from .routes import router
from .scheduler import ConditionScheduler

app = FastAPI(title="Custom Condition Alerts", version="0.1.0")
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
