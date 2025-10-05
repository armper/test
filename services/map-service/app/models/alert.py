from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.types import JSON

from ..db.base_class import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    external_id = Column(String, nullable=False, unique=True, index=True)
    raw = Column(JSON, nullable=False)
    normalized = Column(JSON, nullable=True)
    severity = Column(String, nullable=True)
    sent = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def get_title(self) -> str:
        normalized = self.normalized or {}
        for key in ("title", "headline", "event"):
            value = normalized.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return self.external_id

    def get_event(self) -> Optional[str]:
        normalized = self.normalized or {}
        event = normalized.get("event")
        if isinstance(event, str):
            return event
        return None

    def get_severity(self) -> Optional[str]:
        normalized = self.normalized or {}
        if self.severity:
            return self.severity
        severity = normalized.get("severity")
        if isinstance(severity, str):
            return severity
        return None
