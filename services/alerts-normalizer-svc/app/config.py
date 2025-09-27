from functools import lru_cache
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    service_name: str = "alerts-normalizer-svc"
    kafka_broker: str = Field(..., env="KAFKA_BROKER")
    schema_registry_url: str = Field(..., env="SCHEMA_REGISTRY_URL")
    raw_topic: str = "noaa.alerts.raw.v1"
    normalized_topic: str = "noaa.alerts.normalized.v1"
    fetch_interval_seconds: int = 300
    noaa_api_base: str = "https://api.weather.gov"
    noaa_user_agent: str = Field(..., env="NOAA_USER_AGENT")
    faust_app_id: str = "alerts-normalizer"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
