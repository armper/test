from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, index=True, nullable=False, unique=True)
    channels = Column(JSONB, nullable=False, default=dict)
    quiet_hours = Column(JSONB, nullable=True)
    severity_filter = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
