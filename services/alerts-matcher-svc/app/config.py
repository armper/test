from functools import lru_cache
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    service_name: str = "alerts-matcher-svc"
    kafka_broker: str = Field(..., env="KAFKA_BROKER")
    schema_registry_url: str = Field(..., env="SCHEMA_REGISTRY_URL")
    normalized_topic: str = "noaa.alerts.normalized.v1"
    matched_topic: str = "alerts.matches.user.v1"
    dispatch_topic: str = "notify.dispatch.request.v1"
    faust_app_id: str = "alerts-matcher"
    database_uri: str = Field(..., env="DATABASE_URI")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
