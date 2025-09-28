from datetime import datetime

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
