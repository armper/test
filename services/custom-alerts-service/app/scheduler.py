from __future__ import annotations

import asyncio
from typing import Optional

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
        loop = asyncio.get_running_loop()
        dispatcher = KafkaDispatcher(loop=loop)
        await dispatcher.start()
        self._dispatcher = dispatcher
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

    async def _run(self) -> None:
        assert self._dispatcher is not None
        while not self._stop_event.is_set():
            session = SessionLocal()
            try:
                await evaluate_conditions(session, self._dispatcher)
            except Exception as exc:  # pragma: no cover
                logger.exception("Scheduler evaluation failed", error=str(exc))
            finally:
                session.close()
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=settings.scheduler_interval_seconds)
            except asyncio.TimeoutError:
                continue
