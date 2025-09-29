from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field, validator

ConditionType = Literal[
    "temperature_hot",
    "temperature_cold",
    "precipitation",
    "wind",
]


DEFAULTS: dict[str, dict[str, Any]] = {
    "temperature_hot": {"threshold_value": 85.0, "threshold_unit": "fahrenheit", "comparison": "above"},
    "temperature_cold": {"threshold_value": 32.0, "threshold_unit": "fahrenheit", "comparison": "below"},
    "precipitation": {"threshold_value": 40.0, "threshold_unit": "percent", "comparison": "above"},
    "wind": {"threshold_value": 25.0, "threshold_unit": "mph", "comparison": "above"},
}


class ConditionSubscriptionBase(BaseModel):
    label: str
    condition_type: ConditionType
    latitude: float
    longitude: float
    threshold_value: Optional[float] = None
    threshold_unit: Optional[str] = None
    comparison: Optional[str] = None
    radius_km: Optional[float] = None
    channel_overrides: Dict[str, bool] | None = None
    metadata: Dict[str, Any] | None = None

    @validator("comparison")
    def validate_comparison(cls, value):  # type: ignore[override]
        if value is None:
            return value
        if value not in {"above", "below"}:
            raise ValueError("comparison must be 'above' or 'below'")
        return value


class ConditionSubscriptionCreate(ConditionSubscriptionBase):
    user_id: str


class ConditionSubscriptionUpdate(BaseModel):
    label: Optional[str] = None
    threshold_value: Optional[float] = None
    threshold_unit: Optional[str] = None
    comparison: Optional[str] = None
    channel_overrides: Optional[Dict[str, bool]] = None
    metadata: Optional[Dict[str, Any]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @validator("comparison")
    def validate_comparison(cls, value):  # type: ignore[override]
        if value is None:
            return value
        if value not in {"above", "below"}:
            raise ValueError("comparison must be 'above' or 'below'")
        return value


class ConditionSubscriptionResponse(BaseModel):
    id: int
    user_id: str
    label: str
    condition_type: ConditionType
    threshold_value: float
    threshold_unit: str
    comparison: str
    latitude: float
    longitude: float
    radius_km: Optional[float]
    channel_overrides: Dict[str, bool]
    metadata: Dict[str, Any] | None = Field(None, alias="metadata_json")
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime]

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class ConditionEvaluationResponse(BaseModel):
    triggered: int


class ForecastPeriod(BaseModel):
    start_time: datetime
    short_forecast: str | None = None
    temperature: float | None = None
    temperature_unit: str | None = None


class ForecastPreview(BaseModel):
    periods: list[ForecastPeriod]
