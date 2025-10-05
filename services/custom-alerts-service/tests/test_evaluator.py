from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import pytest

from app.models import AlertDeliveryHistory, ConditionAlert, UserPreference
from app.evaluator import evaluate_conditions


class StubDispatcher:
    def __init__(self) -> None:
        self.messages: list[Dict[str, Any]] = []

    async def send(self, payload: Dict[str, Any]) -> None:
        self.messages.append(payload)


class StubWeatherClient:
    def __init__(self, periods: List[Dict[str, Any]]) -> None:
        self.periods = periods
        self.calls = 0

    async def fetch_hourly_forecast(self, latitude: float, longitude: float) -> List[Dict[str, Any]]:
        self.calls += 1
        return self.periods


@pytest.mark.anyio(backend="asyncio")
async def test_evaluator_triggers_temperature_hot(db_session) -> None:
    user_pref = UserPreference(user_id="user-123", channels={"email": True})
    alert = ConditionAlert(
        user_id="user-123",
        label="Notify me when it's hot",
        condition_type="temperature_hot",
        threshold_value=85.0,
        threshold_unit="fahrenheit",
        comparison="above",
        latitude=40.7128,
        longitude=-74.0060,
        channel_overrides={"sms": False},
    )
    db_session.add(user_pref)
    db_session.add(alert)
    db_session.commit()

    weather_client = StubWeatherClient(
        periods=[
            {
                "startTime": "2024-04-01T12:00:00+00:00",
                "temperature": 90,
                "temperatureUnit": "F",
                "shortForecast": "Sunny",
                "probabilityOfPrecipitation": {"value": 10},
                "windSpeed": "10 mph",
            }
        ]
    )

    dispatcher = StubDispatcher()
    now = datetime.now(timezone.utc)

    await evaluate_conditions(db_session, dispatcher, now=now, weather_client=weather_client)

    assert len(dispatcher.messages) == 1
    message = dispatcher.messages[0]
    assert message["match"]["user_id"] == "user-123"
    assert message["user_preferences"]["channels"]["email"] is True
    assert message["match"]["subscription_id"] == alert.id
    db_session.refresh(alert)
    assert alert.last_triggered_at is not None
    assert weather_client.calls == 1

    history = (
        db_session.query(AlertDeliveryHistory)
        .filter(AlertDeliveryHistory.user_id == "user-123")
        .all()
    )
    assert len(history) == 1
    entry = history[0]
    assert entry.source == "custom"
    assert entry.channels["email"] is True
    assert entry.title.startswith("Notify me")


@pytest.mark.anyio(backend="asyncio")
async def test_evaluator_respects_cooldown(db_session) -> None:
    alert = ConditionAlert(
        user_id="user-456",
        label="Wind watcher",
        condition_type="wind",
        threshold_value=20.0,
        threshold_unit="mph",
        comparison="above",
        latitude=35.0,
        longitude=-97.0,
        metadata_json={"cooldown_minutes": 120},
    )
    db_session.add(alert)
    db_session.commit()

    weather_client = StubWeatherClient(
        periods=[
            {
                "startTime": "2024-04-01T12:00:00+00:00",
                "temperature": 70,
                "temperatureUnit": "F",
                "shortForecast": "Windy",
                "probabilityOfPrecipitation": {"value": 0},
                "windSpeed": "25 mph",
            }
        ]
    )

    dispatcher = StubDispatcher()
    now = datetime.now(timezone.utc)

    await evaluate_conditions(db_session, dispatcher, now=now, weather_client=weather_client)
    assert len(dispatcher.messages) == 1

    await evaluate_conditions(db_session, dispatcher, now=now + timedelta(minutes=30), weather_client=weather_client)
    assert len(dispatcher.messages) == 1

    await evaluate_conditions(db_session, dispatcher, now=now + timedelta(minutes=130), weather_client=weather_client)
    assert len(dispatcher.messages) == 2
    assert weather_client.calls == 2

    history = (
        db_session.query(AlertDeliveryHistory)
        .filter(AlertDeliveryHistory.user_id == "user-456")
        .all()
    )
    assert len(history) == 2


@pytest.mark.anyio(backend="asyncio")
async def test_evaluator_skips_when_threshold_not_met(db_session) -> None:
    alert = ConditionAlert(
        user_id="user-789",
        label="Rain watcher",
        condition_type="precipitation",
        threshold_value=60.0,
        threshold_unit="percent",
        comparison="above",
        latitude=41.0,
        longitude=-73.0,
    )
    db_session.add(alert)
    db_session.commit()

    weather_client = StubWeatherClient(
        periods=[
            {
                "startTime": "2024-04-01T12:00:00+00:00",
                "temperature": 55,
                "temperatureUnit": "F",
                "shortForecast": "Mostly Cloudy",
                "probabilityOfPrecipitation": {"value": 30},
                "windSpeed": "5 mph",
            }
        ]
    )

    dispatcher = StubDispatcher()
    now = datetime.now(timezone.utc)

    await evaluate_conditions(db_session, dispatcher, now=now, weather_client=weather_client)

    assert dispatcher.messages == []
    assert weather_client.calls == 1
    history = (
        db_session.query(AlertDeliveryHistory)
        .filter(AlertDeliveryHistory.user_id == "user-789")
        .all()
    )
    assert history == []
