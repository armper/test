from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import ConditionAlert, UserPreference
from .weather import NoaaWeatherClient


@dataclass
class DispatchRequest:
    match: Dict[str, Any]
    user_preferences: Dict[str, Any]

    def asdict(self) -> Dict[str, Any]:
        return {"match": self.match, "user_preferences": self.user_preferences}


async def evaluate_conditions(
    session: Session,
    dispatcher,
    *,
    now: Optional[datetime] = None,
    weather_client: Optional[NoaaWeatherClient] = None,
) -> None:
    now = now or datetime.now(timezone.utc)
    close_client = False
    if weather_client is None:
        weather_client = NoaaWeatherClient()
        close_client = True

    alerts: List[ConditionAlert] = (
        session.query(ConditionAlert)
        .filter(ConditionAlert.is_active.is_(True))
        .all()
    )

    for alert in alerts:
        try:
            if not _should_evaluate(alert, now):
                continue
            periods = await weather_client.fetch_hourly_forecast(alert.latitude, alert.longitude)
            if not _condition_met(alert, periods):
                continue
            dispatch = _build_dispatch(session, alert, now)
            await dispatcher.send(dispatch.asdict())
            alert.last_triggered_at = _store_timestamp(now)
            alert.apply_update_timestamp()
            session.add(alert)
            logger.info(
                "Custom condition triggered",
                alert_id=alert.id,
                user_id=alert.user_id,
                condition=alert.condition_type,
            )
        except Exception as exc:  # pragma: no cover - logged for observability
            logger.exception("Failed to evaluate condition", alert_id=alert.id, error=str(exc))
            continue

    session.commit()

    if close_client:
        await weather_client.aclose()


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _store_timestamp(dt: datetime) -> datetime:
    return _to_utc(dt).replace(tzinfo=None)


def _should_evaluate(alert: ConditionAlert, now: datetime) -> bool:
    metadata = alert.metadata_json or {}
    cooldown_minutes = metadata.get("cooldown_minutes", settings.cooldown_minutes_default)
    if alert.last_triggered_at is None:
        return True
    last = _to_utc(alert.last_triggered_at)
    current = _to_utc(now)
    elapsed = current - last
    return elapsed >= timedelta(minutes=cooldown_minutes)


def _condition_met(alert: ConditionAlert, periods: Iterable[Dict[str, Any]]) -> bool:
    window = settings.evaluation_window_hours
    sliced = list(periods)[:window]
    comparison = (alert.comparison or "above").lower()
    threshold = alert.threshold_value or 0.0

    if alert.condition_type == "temperature_hot" or alert.condition_type == "temperature_cold":
        for period in sliced:
            temp = period.get("temperature")
            if temp is None:
                continue
            unit = str(period.get("temperatureUnit", "F")).upper()
            temp_f = float(temp)
            if unit.startswith("C"):
                temp_f = (temp_f * 9 / 5) + 32
            if alert.condition_type == "temperature_hot":
                if temp_f >= threshold:
                    return True
            else:
                if temp_f <= threshold:
                    return True
        return False

    if alert.condition_type == "precipitation":
        for period in sliced:
            probability = _extract_precip_probability(period)
            forecast_text = str(period.get("shortForecast", "")).lower()
            if probability is not None and probability >= threshold:
                return True
            if "rain" in forecast_text or "showers" in forecast_text:
                return True
        return False

    if alert.condition_type == "wind":
        for period in sliced:
            speed = _parse_wind_speed(period.get("windSpeed"))
            if speed is None:
                continue
            if comparison == "above" and speed >= threshold:
                return True
            if comparison == "below" and speed <= threshold:
                return True
        return False

    return False


def _extract_precip_probability(period: Dict[str, Any]) -> Optional[float]:
    probability = period.get("probabilityOfPrecipitation")
    if isinstance(probability, dict):
        value = probability.get("value")
        if isinstance(value, (int, float)):
            return float(value)
    if isinstance(probability, (int, float)):
        return float(probability)
    return None


def _parse_wind_speed(value: Any) -> Optional[float]:
    if not value:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    matches = re.findall(r"\d+(?:\.\d+)?", str(value))
    if not matches:
        return None
    numbers = [float(m) for m in matches]
    return max(numbers) if numbers else None


def _build_dispatch(session: Session, alert: ConditionAlert, now: datetime) -> DispatchRequest:
    preferences = _load_user_preferences(session, alert.user_id)
    channels = preferences.get("channels", {}).copy()
    overrides = alert.channel_overrides or {}
    channels.update(overrides)
    if not channels:
        channels = {"push": True}

    user_preferences = {
        "channels": channels,
        "quiet_hours": preferences.get("quiet_hours"),
        "severity_filter": preferences.get("severity_filter"),
    }

    current = _to_utc(now)
    match_payload = {
        "alert_id": f"condition-{alert.id}-{int(current.timestamp())}",
        "user_id": alert.user_id,
        "event": alert.label,
        "severity": "info",
        "sent": current.isoformat(),
        "subscription_id": alert.id,
        "match_score": 1.0,
        "condition_type": alert.condition_type,
    }

    return DispatchRequest(match=match_payload, user_preferences=user_preferences)


def _load_user_preferences(session: Session, user_id: str) -> Dict[str, Any]:
    stmt = select(UserPreference).where(UserPreference.user_id == user_id)
    pref = session.execute(stmt).scalar_one_or_none()
    if pref is None:
        return {"channels": {"push": True}}
    return {
        "channels": pref.channels or {},
        "quiet_hours": getattr(pref, "quiet_hours", None),
        "severity_filter": getattr(pref, "severity_filter", None),
    }
