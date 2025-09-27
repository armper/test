import json
from typing import Any, Dict, Iterable, Tuple

from contextlib import nullcontext as _nullcontext
from mode.utils import compat, contexts  # type: ignore

if not hasattr(compat, "OrderedDict"):
    from collections import OrderedDict

    compat.OrderedDict = OrderedDict  # type: ignore[attr-defined]

if not hasattr(contexts, "nullcontext"):
    contexts.nullcontext = _nullcontext  # type: ignore[attr-defined]

import faust
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import session_scope
from .schemas import DispatchRequest, MatchedAlert, NormalizedAlert

app = faust.App(
    settings.faust_app_id,
    broker=settings.kafka_broker,
    value_serializer="json",
)

normalized_topic = app.topic(settings.normalized_topic, value_serializer="json")
matched_topic = app.topic(settings.matched_topic, value_serializer="json")
dispatch_topic = app.topic(settings.dispatch_topic, value_serializer="json")


@app.agent(normalized_topic)
async def matcher(stream):
    async for raw in stream:
        alert = NormalizedAlert(**raw)
        logger.info("Received alert", alert_id=alert.id)
        for match, preferences in _match_alert(alert):
            await matched_topic.send(value=match.asdict())
            await dispatch_topic.send(value=DispatchRequest(match=match, user_preferences=preferences).asdict())
            logger.info("Produced match", alert_id=alert.id, user_id=match.user_id)


def _match_alert(alert: NormalizedAlert) -> Iterable[Tuple[MatchedAlert, Dict[str, Any]]]:
    if not alert.area_geom:
        return []

    from .tables import AlertSubscription, UserPreference
    from geoalchemy2 import functions as geo

    with session_scope() as session:
        geom = json.dumps(alert.area_geom)
        stmt = (
            select(AlertSubscription, UserPreference)
            .join(UserPreference, UserPreference.user_id == AlertSubscription.user_id)
            .where(geo.ST_Intersects(AlertSubscription.area, geo.ST_GeomFromGeoJSON(geom)))
        )
        results = session.execute(stmt)
        for subscription, prefs in results:
            match = MatchedAlert(
                alert_id=alert.id,
                user_id=subscription.user_id,
                event=alert.event,
                severity=alert.severity,
                sent=alert.sent,
                subscription_id=subscription.id,
            )
            yield match, {
                "channels": prefs.channels or {},
                "quiet_hours": prefs.quiet_hours,
                "severity_filter": prefs.severity_filter,
            }


if __name__ == "__main__":
    app.main()
