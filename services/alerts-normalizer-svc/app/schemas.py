from datetime import datetime
from typing import Any, Dict, Optional

import faust


class RawAlertEnvelope(faust.Record, serializer="json"):
    raw: Dict[str, Any]


class NormalizedAlert(faust.Record, serializer="json"):
    id: str
    sent: datetime
    effective: Optional[datetime]
    expires: Optional[datetime]
    event: Optional[str]
    severity: Optional[str]
    urgency: Optional[str]
    area_geom: Optional[Dict[str, Any]]
    source: str = "noaa"

    @classmethod
    def from_noaa_feature(cls, feature: Dict[str, Any]) -> "NormalizedAlert":
        props = feature.get("properties", {})
        geometry = feature.get("geometry")
        return cls(
            id=props.get("id") or feature.get("id"),
            sent=_parse_dt(props.get("sent")),
            effective=_parse_dt(props.get("effective")),
            expires=_parse_dt(props.get("expires")),
            event=props.get("event"),
            severity=props.get("severity"),
            urgency=props.get("urgency"),
            area_geom=geometry,
        )


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return None
