from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class RegionBase(BaseModel):
    user_id: str = Field(..., description="User identifier")
    name: Optional[str] = None
    area_geojson: Dict[str, Any]
    properties: Optional[Dict[str, Any]] = None


class RegionCreate(RegionBase):
    pass


class RegionResponse(RegionBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
