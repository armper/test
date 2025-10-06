from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import httpx

from .config import settings


class NoaaWeatherClient:
    def __init__(self, *, client: Optional[httpx.AsyncClient] = None) -> None:
        self._external_client = client is not None
        self._client = client or httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={
                "User-Agent": settings.noaa_user_agent,
                "Accept": "application/geo+json",
            },
        )

    async def fetch_hourly_forecast(self, latitude: float, longitude: float) -> List[Dict[str, Any]]:
        points_url = f"{settings.noaa_base_url}/points/{latitude},{longitude}"
        response = await self._get_with_retry(points_url)
        payload = response.json()
        forecast_url = payload.get("properties", {}).get("forecastHourly")
        if not forecast_url:
            raise RuntimeError("NOAA response missing forecastHourly URL")
        forecast_response = await self._get_with_retry(forecast_url)
        forecast_payload = forecast_response.json()
        periods = forecast_payload.get("properties", {}).get("periods", [])
        if not isinstance(periods, list):
            raise RuntimeError("NOAA hourly forecast missing periods list")
        return periods

    async def _get_with_retry(self, url: str) -> httpx.Response:
        attempt = 0
        delay = settings.noaa_initial_backoff_seconds
        while True:
            try:
                response = await self._client.get(url)
                response.raise_for_status()
                return response
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status not in {429, 500, 502, 503, 504} or attempt >= settings.noaa_max_retries:
                    raise
            except httpx.TransportError:
                if attempt >= settings.noaa_max_retries:
                    raise
            attempt += 1
            await asyncio.sleep(delay)
            delay *= settings.noaa_backoff_factor
    async def fetch_forecast_preview(self, latitude: float, longitude: float, periods: int = 3):
        hourly = await self.fetch_hourly_forecast(latitude, longitude)
        summary = []
        for period in hourly[:periods]:
            summary.append({
                "start_time": period.get("startTime"),
                "short_forecast": period.get("shortForecast"),
                "temperature": period.get("temperature"),
                "temperature_unit": period.get("temperatureUnit"),
            })
        return summary


    async def aclose(self) -> None:
        if not self._external_client:
            await self._client.aclose()

    async def __aenter__(self) -> "NoaaWeatherClient":
        return self

    async def __aexit__(self, exc_type, exc_value, traceback) -> None:
        await self.aclose()
