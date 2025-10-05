from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AlertHistoryCreate(BaseModel):
    user_id: str
    source: str
    source_id: Optional[str]
    title: str
    summary: Optional[str]
    severity: Optional[str]
    channels: Dict[str, bool] = Field(default_factory=dict)
    triggered_at: datetime
    payload: Optional[Dict[str, Any]] = None



class AlertHistoryItem(BaseModel):
    id: int
    user_id: str
    title: str
    summary: Optional[str]
    severity: Optional[str]
    source: str
    source_id: Optional[str]
    channels: Dict[str, bool] = Field(default_factory=dict)
    triggered_at: datetime
    created_at: datetime
    payload: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True


class AlertHistoryResponse(BaseModel):
    items: List[AlertHistoryItem]
    total: int
    page: int
    page_size: int
    has_next: bool
