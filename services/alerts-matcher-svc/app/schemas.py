from datetime import datetime
from typing import Any, Dict, Optional, Tuple

import faust


class NormalizedAlert(faust.Record, serializer="json"):
    id: str
    sent: datetime
    event: Optional[str]
    severity: Optional[str]
    area_geom: Optional[Dict[str, Any]]


class MatchedAlert(faust.Record, serializer="json"):
    alert_id: str
    user_id: str
    event: Optional[str]
    severity: Optional[str]
    sent: datetime
    subscription_id: int
    match_score: float = 1.0


class DispatchRequest(faust.Record, serializer="json"):
    match: MatchedAlert
    user_preferences: Dict[str, Any]
