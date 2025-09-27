import asyncio
from typing import Any, Dict

from contextlib import nullcontext as _nullcontext
from mode.utils import compat, contexts  # type: ignore

if not hasattr(compat, "OrderedDict"):
    from collections import OrderedDict

    compat.OrderedDict = OrderedDict  # type: ignore[attr-defined]

if not hasattr(contexts, "nullcontext"):
    contexts.nullcontext = _nullcontext  # type: ignore[attr-defined]

import faust
import httpx
from loguru import logger

from .config import settings
from .schemas import NormalizedAlert, RawAlertEnvelope

app = faust.App(
    settings.faust_app_id,
    broker=settings.kafka_broker,
    value_serializer="json",
)

raw_topic = app.topic(settings.raw_topic, value_serializer="json")
normalized_topic = app.topic(settings.normalized_topic, value_serializer="json")


@app.timer(interval=settings.fetch_interval_seconds)
async def fetch_and_publish() -> None:
    url = f"{settings.noaa_api_base}/alerts/active"
    headers = {"User-Agent": settings.noaa_user_agent, "Accept": "application/geo+json"}
    async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()

    for feature in payload.get("features", []):
        envelope = RawAlertEnvelope(raw=feature)
        await raw_topic.send(value=envelope.asdict())
        normalized = NormalizedAlert.from_noaa_feature(feature)
        await normalized_topic.send(value=normalized.asdict())
        logger.debug("Published NOAA alert", alert_id=normalized.id)


async def ensure_topics() -> None:
    await asyncio.gather(
        raw_topic.maybe_declare(),
        normalized_topic.maybe_declare(),
    )


if __name__ == "__main__":
    app.main()
