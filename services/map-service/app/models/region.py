from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from ..db.base_class import Base


class Region(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=True)
    area = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    properties = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
