from datetime import datetime

import pytest

from app.models import ConditionAlert, UserPreference
from app.schemas import DEFAULT_RADIUS_KM
from app.weather import NoaaWeatherClient


@pytest.fixture(autouse=True)
def _freeze_weather(monkeypatch):
    async def fake_fetch(self, latitude, longitude):  # type: ignore[override]
        return [
            {
                "startTime": "2024-04-01T12:00:00+00:00",
                "temperature": 90,
                "temperatureUnit": "F",
                "shortForecast": "Sunny",
                "probabilityOfPrecipitation": {"value": 10},
                "windSpeed": "10 mph",
            }
        ]

    async def fake_close(self):  # type: ignore[override]
        return None

    monkeypatch.setattr(NoaaWeatherClient, "fetch_hourly_forecast", fake_fetch)
    monkeypatch.setattr(NoaaWeatherClient, "aclose", fake_close)


def create_alert(client):
    payload = {
        "user_id": "user-123",
        "label": "Test alert",
        "condition_type": "temperature_hot",
        "latitude": 40.0,
        "longitude": -75.0,
    }
    response = client.post("/api/v1/conditions/subscriptions", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["radius_km"] == pytest.approx(DEFAULT_RADIUS_KM)
    return data


def test_run_endpoint_updates_last_triggered(client, session_local):
    created = create_alert(client)

    run_response = client.post("/api/v1/conditions/run?dry_run=true")
    assert run_response.status_code == 200
    assert run_response.json() == {"triggered": 1}

    session = session_local()
    try:
        alert = session.get(ConditionAlert, created["id"])
        assert alert is not None
        assert alert.last_triggered_at is not None
        assert isinstance(alert.last_triggered_at, datetime)
    finally:
        session.close()


def test_run_endpoint_merges_channel_overrides(client, session_local, monkeypatch):
    session = session_local()
    pref = UserPreference(user_id="user-override", channels={"email": True})
    session.add(pref)
    session.commit()
    session.close()

    payload = {
        "user_id": "user-override",
        "label": "Wind warning",
        "condition_type": "wind",
        "threshold_value": 10,
        "latitude": 45.0,
        "longitude": -93.0,
        "channel_overrides": {"sms": True},
    }
    response = client.post("/api/v1/conditions/subscriptions", json=payload)
    assert response.status_code == 201

    recorded = []

    class Recorder:
        def __init__(self) -> None:
            self.messages = recorded

        async def send(self, payload):  # type: ignore[override]
            recorded.append(payload)

    monkeypatch.setattr("app.routes._DryRunDispatcher", Recorder)

    run_response = client.post("/api/v1/conditions/run?dry_run=true")
    assert run_response.status_code == 200
    assert run_response.json()["triggered"] == 1

    assert recorded, "Expected dry-run dispatcher to capture at least one message"
    match = recorded[0]["match"]
    assert match["latitude"] == pytest.approx(payload["latitude"])
    assert match["longitude"] == pytest.approx(payload["longitude"])
    assert match["radius_km"] == pytest.approx(payload.get("radius_km", DEFAULT_RADIUS_KM))

    channels = recorded[0]["user_preferences"]["channels"]
    assert channels["email"] is True
    assert channels["sms"] is True


def test_forecast_preview_returns_periods(client, monkeypatch):
    async def fake_preview(self, latitude, longitude, periods):
        return [
            {
                "start_time": "2024-04-01T12:00:00+00:00",
                "short_forecast": "Sunny",
                "temperature": 72,
                "temperature_unit": "F",
            }
        ]

    monkeypatch.setattr(
        "app.weather.NoaaWeatherClient.fetch_forecast_preview",
        fake_preview,
    )

    async def fake_close(self):
        return None

    monkeypatch.setattr(
        "app.weather.NoaaWeatherClient.aclose",
        fake_close,
    )
    response = client.get("/api/v1/conditions/preview", params={"latitude": 40.0, "longitude": -74.0})
    assert response.status_code == 200
    body = response.json()
    assert len(body["periods"]) == 1
    assert body["periods"][0]["short_forecast"] == "Sunny"


def test_forecast_preview_handles_failure(client, monkeypatch):
    async def fake_preview(self, latitude, longitude, periods):
        raise RuntimeError("noaa down")

    async def fake_close(self):
        return None

    monkeypatch.setattr("app.weather.NoaaWeatherClient.fetch_forecast_preview", fake_preview)
    monkeypatch.setattr("app.weather.NoaaWeatherClient.aclose", fake_close)

    response = client.get("/api/v1/conditions/preview", params={"latitude": 40.0, "longitude": -74.0})
    assert response.status_code == 200
    body = response.json()
    assert body["periods"] == []
