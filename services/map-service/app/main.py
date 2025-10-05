from fastapi import FastAPI

from .api.routes import router as api_router
from .core.config import settings


def register_health_checks(app: FastAPI) -> None:
    @app.get("/healthz", tags=["Health"], summary="Service health check")
    async def healthcheck() -> dict:
        return {"status": "ok", "service": settings.PROJECT_NAME}


def create_app() -> FastAPI:
    app = FastAPI(
        title="Map Service",
        description=(
            "Provides geo-boundary management and city datasets used to visualize and "
            "target weather alert regions."
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
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    register_health_checks(app)
    return app


app = create_app()
