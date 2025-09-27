from fastapi import FastAPI

from .api.routes import router as api_router
from .core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title="Map Service", version="0.1.0")
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    return app


app = create_app()
