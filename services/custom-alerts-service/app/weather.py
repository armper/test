from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from .config import settings


class NoaaWeatherClient:
    def __init__(self, *, client: Optional[httpx.AsyncClient] = None) -> None:
        self._external_client = client is not None
        self._client = client or httpx.AsyncClient(
            timeout=15.0,
            headers={
                "User-Agent": settings.noaa_user_agent,
                "Accept": "application/geo+json",
            },
        )

    async def fetch_hourly_forecast(self, latitude: float, longitude: float) -> List[Dict[str, Any]]:
        points_url = f"{settings.noaa_base_url}/points/{latitude},{longitude}"
        response = await self._client.get(points_url)
        response.raise_for_status()
        payload = response.json()
        forecast_url = payload.get("properties", {}).get("forecastHourly")
        if not forecast_url:
            raise RuntimeError("NOAA response missing forecastHourly URL")
        forecast_response = await self._client.get(forecast_url)
        forecast_response.raise_for_status()
        forecast_payload = forecast_response.json()
        periods = forecast_payload.get("properties", {}).get("periods", [])
        if not isinstance(periods, list):
            raise RuntimeError("NOAA hourly forecast missing periods list")
        return periods

    async def aclose(self) -> None:
        if not self._external_client:
            await self._client.aclose()

    async def __aenter__(self) -> "NoaaWeatherClient":
        return self

    async def __aexit__(self, exc_type, exc_value, traceback) -> None:
        await self.aclose()
