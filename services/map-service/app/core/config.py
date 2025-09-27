from functools import lru_cache

from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "map-service"

    SQLALCHEMY_DATABASE_URI: str = Field(..., env="MAP_SERVICE_DATABASE_URI")

    DEFAULT_CITY_DATA: str = "app/data/cities.geojson"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
