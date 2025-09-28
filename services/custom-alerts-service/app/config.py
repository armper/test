from functools import lru_cache
from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    service_name: str = Field("custom-alerts-service", env="CUSTOM_ALERTS_SERVICE_NAME")
    database_uri: str = Field(
        "postgresql+psycopg2://weather:weather@localhost:5432/weather",
        env="CUSTOM_ALERTS_DATABASE_URI",
    )
    noaa_base_url: str = Field("https://api.weather.gov", env="CUSTOM_ALERTS_NOAA_BASE_URL")
    noaa_user_agent: str = Field(
        "WeatherAlertsCustomConditions/0.1 (support@example.com)",
        env="CUSTOM_ALERTS_NOAA_USER_AGENT",
    )
    evaluation_window_hours: int = Field(6, env="CUSTOM_ALERTS_WINDOW_HOURS")
    cooldown_minutes_default: int = Field(60, env="CUSTOM_ALERTS_COOLDOWN_MINUTES")
    kafka_bootstrap_servers: str = Field("kafka:9092", env="CUSTOM_ALERTS_KAFKA_BOOTSTRAP")
    dispatch_topic: str = Field("notify.dispatch.request.v1", env="CUSTOM_ALERTS_DISPATCH_TOPIC")
    enable_scheduler: bool = Field(False, env="CUSTOM_ALERTS_ENABLE_SCHEDULER")
    scheduler_interval_seconds: int = Field(600, env="CUSTOM_ALERTS_SCHEDULER_INTERVAL")
    scheduler_start_max_retries: int = Field(10, env="CUSTOM_ALERTS_SCHEDULER_RETRIES")
    scheduler_start_backoff_seconds: int = Field(5, env="CUSTOM_ALERTS_SCHEDULER_BACKOFF")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]


settings = get_settings()
