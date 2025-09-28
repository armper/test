from __future__ import annotations

import json
from typing import Any, Dict, Optional

from aiokafka import AIOKafkaProducer

from .config import settings


class KafkaDispatcher:
    def __init__(self, *, loop=None, topic: Optional[str] = None) -> None:
        self._topic = topic or settings.dispatch_topic
        self._producer = AIOKafkaProducer(
            loop=loop,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            value_serializer=lambda value: json.dumps(value).encode("utf-8"),
            key_serializer=lambda value: value.encode("utf-8"),
            enable_idempotence=True,
            linger_ms=20,
        )

    async def start(self) -> None:
        await self._producer.start()

    async def stop(self) -> None:
        await self._producer.stop()

    async def send(self, payload: Dict[str, Any]) -> None:
        key = payload.get("match", {}).get("user_id", "")
        await self._producer.send_and_wait(self._topic, value=payload, key=key)
