from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.schemas import DEFAULT_RADIUS_KM


def test_create_subscription_applies_defaults(client: TestClient) -> None:
    payload: dict[str, Any] = {
        "user_id": "user-123",
        "label": "Let me know when it's hot",
        "condition_type": "temperature_hot",
        "latitude": 40.7128,
        "longitude": -74.0060,
    }

    response = client.post("/api/v1/conditions/subscriptions", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["threshold_value"] == pytest.approx(85.0)
    assert body["threshold_unit"] == "fahrenheit"
    assert body["comparison"] == "above"
    assert body["channel_overrides"] == {}
    assert body["user_id"] == payload["user_id"]
    assert body["label"] == payload["label"]
    assert body["radius_km"] == pytest.approx(DEFAULT_RADIUS_KM)


def test_list_subscriptions_returns_only_active(client: TestClient) -> None:
    payload = {
        "user_id": "user-abc",
        "label": "Alert me when it's windy",
        "condition_type": "wind",
        "latitude": 39.95,
        "longitude": -75.16,
    }
    created = client.post("/api/v1/conditions/subscriptions", json=payload)
    assert created.status_code == 201

    list_response = client.get(f"/api/v1/conditions/subscriptions/{payload['user_id']}")
    assert list_response.status_code == 200
    items = list_response.json()
    assert len(items) == 1
    assert items[0]["condition_type"] == "wind"

    delete_response = client.delete(f"/api/v1/conditions/subscriptions/{items[0]['id']}")
    assert delete_response.status_code == 204

    after_delete = client.get(f"/api/v1/conditions/subscriptions/{payload['user_id']}")
    assert after_delete.status_code == 200
    assert after_delete.json() == []


def test_update_subscription_allows_threshold_override(client: TestClient) -> None:
    payload = {
        "user_id": "user-xyz",
        "label": "Notify me if it rains",
        "condition_type": "precipitation",
        "latitude": 47.6062,
        "longitude": -122.3321,
    }
    created = client.post("/api/v1/conditions/subscriptions", json=payload)
    assert created.status_code == 201
    item = created.json()

    update_payload = {
        "threshold_value": 60.0,
        "threshold_unit": "percent",
        "radius_km": 42.0,
    }
    update_response = client.put(
        f"/api/v1/conditions/subscriptions/{item['id']}",
        json=update_payload,
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["threshold_value"] == 60.0
    assert updated["threshold_unit"] == "percent"
    assert updated["comparison"] == "above"
    assert updated["label"] == payload["label"]
    assert updated["radius_km"] == pytest.approx(42.0)



def test_run_endpoint_returns_summary(client: TestClient) -> None:
    response = client.post("/api/v1/conditions/run")
    assert response.status_code == 200
    assert response.json() == {"triggered": 0}
