import os
import sys
from pathlib import Path

os.environ.setdefault("MAP_SERVICE_DATABASE_URI", "sqlite:///test.db")

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_cities_returns_geojson() -> None:
    response = client.get("/api/v1/cities")
    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "FeatureCollection"
    assert "features" in payload
