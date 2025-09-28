from __future__ import annotations

import asyncio
from typing import Optional

from aiokafka.errors import KafkaConnectionError
from loguru import logger

from .config import settings
from .db import SessionLocal
from .dispatcher import KafkaDispatcher
from .evaluator import evaluate_conditions


class ConditionScheduler:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._dispatcher: Optional[KafkaDispatcher] = None
        self._stop_event = asyncio.Event()

    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run())
        logger.info("Condition scheduler started")

    async def stop(self) -> None:
        if self._task is not None:
            self._stop_event.set()
            await self._task
            self._task = None
        if self._dispatcher is not None:
            await self._dispatcher.stop()
            self._dispatcher = None
        logger.info("Condition scheduler stopped")

    async def _ensure_dispatcher(self) -> Optional[KafkaDispatcher]:
        if self._dispatcher is not None:
            return self._dispatcher
        loop = asyncio.get_running_loop()
        dispatcher = KafkaDispatcher(loop=loop)
        for attempt in range(settings.scheduler_start_max_retries):
            try:
                await dispatcher.start()
                self._dispatcher = dispatcher
                logger.info("Kafka dispatcher ready for scheduler")
                return dispatcher
            except KafkaConnectionError as exc:
                logger.warning(
                    "Kafka not ready for scheduler",
                    attempt=attempt + 1,
                    error=str(exc),
                )
                await asyncio.sleep(settings.scheduler_start_backoff_seconds)
        logger.error("Failed to start Kafka dispatcher after retries; scheduler will retry later")
        return None

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            dispatcher = await self._ensure_dispatcher()
            session = SessionLocal()
            try:
                if dispatcher is not None:
                    await evaluate_conditions(session, dispatcher)
            except Exception as exc:  # pragma: no cover
                logger.exception("Scheduler evaluation failed", error=str(exc))
                if self._dispatcher is dispatcher:
                    await dispatcher.stop()
                    self._dispatcher = None
            finally:
                session.close()
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=settings.scheduler_interval_seconds)
            except asyncio.TimeoutError:
                continue
