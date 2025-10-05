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
