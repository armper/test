import os
import sys
from pathlib import Path

os.environ.setdefault("KAFKA_BROKER", "kafka://localhost:9092")
os.environ.setdefault("SCHEMA_REGISTRY_URL", "http://localhost:8081")
os.environ.setdefault("NOAA_USER_AGENT", "test-agent")

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/healthz")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
