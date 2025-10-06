from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.types import JSON, TypeDecorator


class JSONFlexible(TypeDecorator):
    """Use JSONB on PostgreSQL while keeping compatibility with SQLite tests."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":  # pragma: no cover - requires PostgreSQL dialect
            from sqlalchemy.dialects.postgresql import JSONB

            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


JSONType = JSONFlexible

from ..db.base_class import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AlertDeliveryHistory(Base):
    __tablename__ = "alert_delivery_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False)
    source_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    summary = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    channels = Column(JSONType, nullable=False, default=dict)
    triggered_at = Column(DateTime(timezone=True), nullable=False, index=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def channel_list(self) -> List[str]:
        data = self.channels or {}
        if isinstance(data, dict):
            return [name for name, enabled in data.items() if bool(enabled)]
        if isinstance(data, list):
            return [str(item) for item in data]
        return []

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "source": self.source,
            "source_id": self.source_id,
            "title": self.title,
            "summary": self.summary,
            "severity": self.severity,
            "channels": self.channels,
            "triggered_at": self.triggered_at,
            "payload": self.payload,
            "created_at": self.created_at,
        }

    @staticmethod
    def build_summary(payload: Optional[Dict[str, Any]]) -> Optional[str]:
        if not payload:
            return None
        headline = payload.get("headline") or payload.get("title")
        event = payload.get("event")
        description = payload.get("description") or payload.get("summary")
        for value in (headline, event, description):
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None
