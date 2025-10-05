from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AlertSummary(BaseModel):
    id: int
    external_id: str
    title: str
    event: Optional[str]
    severity: Optional[str]
    sent: datetime

    class Config:
        orm_mode = True
