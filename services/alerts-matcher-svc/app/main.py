from fastapi import FastAPI

from .config import settings

app = FastAPI(
    title="Alerts Matcher Service",
    description=(
        "Matches normalized NOAA alerts against user subscriptions and routes matches "
        "to downstream notification workflows."
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


@app.get("/healthz")
async def healthcheck() -> dict:
    return {
        "status": "ok",
        "service": settings.service_name,
    }
