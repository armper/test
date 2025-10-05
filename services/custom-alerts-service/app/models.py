from datetime import datetime, timezone
from typing import List

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.types import JSON

from .db import Base


class ConditionAlert(Base):
    __tablename__ = "condition_alerts"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, index=True, nullable=False)
    label = Column(String, nullable=False)
    condition_type = Column(String, nullable=False)
    threshold_value = Column(Float, nullable=True)
    threshold_unit = Column(String, nullable=True)
    comparison = Column(String, nullable=False, default="above")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_km = Column(Float, nullable=True)
    channel_overrides = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, nullable=False, default=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_triggered_at = Column(DateTime, nullable=True)
    next_evaluation_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    def apply_update_timestamp(self) -> None:
        self.updated_at = datetime.utcnow()


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, unique=True, nullable=False)
    channels = Column(JSON, nullable=False, default=dict)
    quiet_hours = Column(JSON, nullable=True)
    severity_filter = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


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
    channels = Column(JSON, nullable=False, default=dict)
    triggered_at = Column(DateTime(timezone=True), nullable=False, index=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    def channel_list(self) -> List[str]:
        data = self.channels or {}
        if isinstance(data, dict):
            return [name for name, enabled in data.items() if bool(enabled)]
        if isinstance(data, list):
            return [str(item) for item in data]
        return []

    @staticmethod
    def build_summary(payload):
        if not isinstance(payload, dict):
            return None
        for key in ("summary", "headline", "title", "event", "description"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None
