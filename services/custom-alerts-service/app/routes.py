import asyncio
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .dispatcher import KafkaDispatcher
from .db import get_session
from .evaluator import evaluate_conditions
from .models import ConditionAlert
from .schemas import (
    ConditionEvaluationResponse,
    ConditionSubscriptionCreate,
    ConditionSubscriptionResponse,
    ConditionSubscriptionUpdate,
    ForecastPreview,
    DEFAULTS,
)
from .weather import NoaaWeatherClient

router = APIRouter(prefix="/api/v1/conditions", tags=["conditions"])


class _DryRunDispatcher:
    def __init__(self) -> None:
        self.messages: List[dict] = []

    async def send(self, payload: dict) -> None:
        self.messages.append(payload)


def _apply_defaults(payload: ConditionSubscriptionCreate) -> dict:
    defaults = DEFAULTS[payload.condition_type]
    data = payload.dict()
    if data.get("threshold_value") is None:
        data["threshold_value"] = defaults["threshold_value"]
    if data.get("threshold_unit") is None:
        data["threshold_unit"] = defaults["threshold_unit"]
    if data.get("comparison") is None:
        data["comparison"] = defaults["comparison"]
    if data.get("channel_overrides") is None:
        data["channel_overrides"] = {}
    metadata = data.pop("metadata", None)
    if metadata is not None:
        data["metadata_json"] = metadata
    return data


@router.post("/subscriptions", response_model=ConditionSubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_subscription(
    payload: ConditionSubscriptionCreate,
    db: Session = Depends(get_session),
) -> ConditionSubscriptionResponse:
    data = _apply_defaults(payload)
    alert = ConditionAlert(**data)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return ConditionSubscriptionResponse.from_orm(alert)


@router.get("/subscriptions/{user_id}", response_model=List[ConditionSubscriptionResponse])
def list_subscriptions(
    user_id: str,
    db: Session = Depends(get_session),
) -> List[ConditionSubscriptionResponse]:
    items = (
        db.query(ConditionAlert)
        .filter(ConditionAlert.user_id == user_id, ConditionAlert.is_active.is_(True))
        .order_by(ConditionAlert.created_at.desc())
        .all()
    )
    return [ConditionSubscriptionResponse.from_orm(item) for item in items]


@router.put("/subscriptions/{subscription_id}", response_model=ConditionSubscriptionResponse)
def update_subscription(
    subscription_id: int,
    payload: ConditionSubscriptionUpdate,
    db: Session = Depends(get_session),
) -> ConditionSubscriptionResponse:
    alert = db.get(ConditionAlert, subscription_id)
    if alert is None or not alert.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    update_data = payload.dict(exclude_unset=True)
    if "metadata" in update_data:
        metadata = update_data.pop("metadata")
        update_data["metadata_json"] = metadata
    for key, value in update_data.items():
        setattr(alert, key, value)
    alert.apply_update_timestamp()
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return ConditionSubscriptionResponse.from_orm(alert)


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription(
    subscription_id: int,
    db: Session = Depends(get_session),
) -> None:
    alert = db.get(ConditionAlert, subscription_id)
    if alert is None or not alert.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    alert.is_active = False
    alert.apply_update_timestamp()
    db.add(alert)
    db.commit()


@router.post("/run", response_model=ConditionEvaluationResponse)
async def run_conditions(
    dry_run: bool = True,
    db: Session = Depends(get_session),
) -> ConditionEvaluationResponse:
    if dry_run:
        dispatcher = _DryRunDispatcher()
        await evaluate_conditions(db, dispatcher)
        return ConditionEvaluationResponse(triggered=len(dispatcher.messages))

    loop = asyncio.get_running_loop()
    dispatcher = KafkaDispatcher(loop=loop)
    await dispatcher.start()
    try:
        await evaluate_conditions(db, dispatcher)
    finally:
        await dispatcher.stop()
    return ConditionEvaluationResponse(triggered=0)


@router.get("/preview", response_model=ForecastPreview)
async def preview_forecast(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    periods: int = Query(3, ge=1, le=6),
) -> ForecastPreview:
    client = NoaaWeatherClient()
    try:
        data = await client.fetch_forecast_preview(latitude, longitude, periods)
    finally:
        await client.aclose()
    formatted = [
        {
            "start_time": item.get("start_time"),
            "short_forecast": item.get("short_forecast"),
            "temperature": item.get("temperature"),
            "temperature_unit": item.get("temperature_unit"),
        }
        for item in data
    ]
    return ForecastPreview(periods=formatted)
