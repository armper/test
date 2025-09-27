from datetime import datetime
from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class AlertSubscription(Base):
    __tablename__ = "alert_subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, index=True, nullable=False)
    area = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    metadata = Column(JSONB, nullable=True)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, unique=True, nullable=False)
    channels = Column(JSONB, nullable=False, default=dict)
    quiet_hours = Column(JSONB, nullable=True)
    severity_filter = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
