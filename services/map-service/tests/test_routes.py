import os
import sys
from datetime import datetime, timezone
from pathlib import Path

base_dir = Path(__file__).resolve().parents[1]
os.environ.setdefault("MAP_SERVICE_DATABASE_URI", "sqlite:///test.db")
os.environ.setdefault("DEFAULT_CITY_DATA", str(base_dir / "app/data/cities.geojson"))

sys.path.append(str(base_dir))

from fastapi.testclient import TestClient

from app.db.session import SessionLocal, engine
from app.main import app
from app.models.alert import Alert
from app.models.alert_history import AlertDeliveryHistory

client = TestClient(app)


def test_list_cities_returns_geojson() -> None:
    response = client.get("/api/v1/cities")
    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "FeatureCollection"
    assert "features" in payload


def test_list_alerts_returns_recent_alerts() -> None:
    Alert.__table__.create(bind=engine, checkfirst=True)
    with SessionLocal() as db:
        db.query(Alert).delete()
        db.add_all(
            [
                Alert(
                    external_id="alert-1",
                    raw={},
                    normalized={
                        "title": "Flood Watch",
                        "event": "Flood",
                        "severity": "moderate",
                        "sent": "2024-01-01T05:00:00Z",
                    },
                    severity="moderate",
                    sent=datetime(2024, 1, 1, 5, 0, 0, tzinfo=timezone.utc),
                ),
                Alert(
                    external_id="alert-2",
                    raw={},
                    normalized={
                        "headline": "High Wind Warning",
                        "event": "Wind",
                        "severity": "severe",
                        "sent": "2024-02-01T08:30:00Z",
                    },
                    severity="severe",
                    sent=datetime(2024, 2, 1, 8, 30, 0, tzinfo=timezone.utc),
                ),
            ]
        )
        db.commit()

    response = client.get("/api/v1/alerts", params={"limit": 1})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    first = data[0]
    assert first["external_id"] == "alert-2"
    assert first["title"] == "High Wind Warning"
    assert first["event"] == "Wind"
    assert first["severity"] == "severe"
    assert first["sent"].startswith("2024-02-01T08:30:00")


def test_create_and_list_alert_history() -> None:
    AlertDeliveryHistory.__table__.create(bind=engine, checkfirst=True)
    with SessionLocal() as db:
        db.query(AlertDeliveryHistory).delete()
        db.commit()

    triggered = datetime(2024, 3, 10, 12, 30, tzinfo=timezone.utc)
    payload = {
        "user_id": "42",
        "source": "custom",
        "source_id": "condition-7",
        "title": "Heat index over 95°F",
        "summary": "Heat wave warning",
        "severity": "warning",
        "channels": {"push": True, "email": False},
        "triggered_at": triggered.isoformat(),
        "payload": {"description": "Feels like 102F"},
    }

    response = client.post("/api/v1/alerts/history", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == "42"
    assert data["source"] == "custom"
    assert data["severity"] == "warning"
    assert data["channels"]["push"] is True

    # Add another entry to verify pagination and filters
    with SessionLocal() as db:
        db.add(
            AlertDeliveryHistory(
                user_id="42",
                source="noaa",
                source_id="noaa-123",
                title="Flood advisory",
                summary="Minor flooding possible",
                severity="advisory",
                channels={"sms": True},
                triggered_at=datetime(2024, 3, 9, 7, 45, tzinfo=timezone.utc),
                payload={"event": "Flood"},
            )
        )
        db.add(
            AlertDeliveryHistory(
                user_id="99",
                source="custom",
                source_id="condition-9",
                title="High winds",
                summary="Wind gusts",
                severity="warning",
                channels={"push": True},
                triggered_at=datetime(2024, 3, 11, 6, 0, tzinfo=timezone.utc),
                payload={"event": "Wind"},
            )
        )
        db.commit()

    history = client.get(
        "/api/v1/alerts/history",
        params={"user_id": "42", "page": 1, "page_size": 1, "source": "custom"},
    )
    assert history.status_code == 200
    content = history.json()
    assert content["total"] == 1
    assert content["items"][0]["title"] == "Heat index over 95°F"

    sms_history = client.get(
        "/api/v1/alerts/history",
        params={"user_id": "42", "channel": "sms"},
    )
    assert sms_history.status_code == 200
    sms_data = sms_history.json()
    assert sms_data["total"] == 1
    assert sms_data["items"][0]["source"] == "noaa"
