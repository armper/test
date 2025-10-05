import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import CompileError
from sqlalchemy.orm import Session

from ..core import deps
from ..core.config import settings
from ..db.base import Base
from ..db.session import engine
from ..models.alert import Alert
from ..models.alert_history import AlertDeliveryHistory
from ..models.region import Region
from ..schemas import (
    AlertHistoryCreate,
    AlertHistoryItem,
    AlertHistoryResponse,
    AlertSummary,
    RegionCreate,
    RegionResponse,
    RegionUpdate,
)
from ..services.geoutil import geojson_to_geometry, geometry_to_geojson

router = APIRouter()


@router.on_event("startup")
def on_startup() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except CompileError:
        Alert.__table__.create(bind=engine, checkfirst=True)


@router.get("/cities")
def list_cities() -> dict:
    path = Path(settings.DEFAULT_CITY_DATA)
    if not path.exists():
        raise HTTPException(status_code=500, detail="City dataset missing")
    return json.loads(path.read_text())


@router.get("/alerts", response_model=List[AlertSummary])
def list_alerts(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(deps.get_db_session),
) -> List[AlertSummary]:
    stmt = select(Alert).order_by(Alert.sent.desc(), Alert.created_at.desc()).limit(limit)
    records = db.execute(stmt).scalars().all()

    def _parse_sent(value: Any, fallback: datetime) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned.endswith("Z"):
                cleaned = cleaned[:-1] + "+00:00"
            try:
                return datetime.fromisoformat(cleaned)
            except ValueError:
                pass
        return fallback

    payload: List[AlertSummary] = []
    for record in records:
        normalized = record.normalized or {}
        sent_fallback = record.sent or record.created_at
        payload.append(
            AlertSummary(
                id=record.id,
                external_id=record.external_id,
                title=record.get_title(),
                event=record.get_event(),
                severity=record.get_severity(),
                sent=_parse_sent(normalized.get("sent"), sent_fallback),
            )
        )
    return payload


@router.get("/alerts/history", response_model=AlertHistoryResponse)
def list_alert_history(
    user_id: str = Query(..., min_length=1, max_length=255),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: Optional[str] = Query(None, min_length=2, max_length=50),
    severity: Optional[str] = Query(None, min_length=2, max_length=32),
    channel: Optional[str] = Query(None, min_length=2, max_length=32),
    search: Optional[str] = Query(None, min_length=2, max_length=120),
    db: Session = Depends(deps.get_db_session),
) -> AlertHistoryResponse:
    records = (
        db.query(AlertDeliveryHistory)
        .filter(AlertDeliveryHistory.user_id == user_id)
        .order_by(AlertDeliveryHistory.triggered_at.desc(), AlertDeliveryHistory.id.desc())
        .all()
    )

    search_lower = search.lower() if search else None
    source_lower = source.lower() if source else None
    severity_lower = severity.lower() if severity else None
    channel_lower = channel.lower() if channel else None

    filtered: List[AlertDeliveryHistory] = []
    # SQLite used in tests lacks rich JSON operators, so apply flexible filtering in Python space.
    for record in records:
        if source_lower and (record.source or "").lower() != source_lower:
            continue
        if severity_lower and (record.severity or "").lower() != severity_lower:
            continue
        if channel_lower:
            channels = [name.lower() for name in record.channel_list()]
            if channel_lower not in channels:
                continue
        if search_lower:
            haystacks = [record.title or "", record.summary or ""]
            if record.payload and isinstance(record.payload, dict):
                description = record.payload.get("description")
                if isinstance(description, str):
                    haystacks.append(description)
            if not any(search_lower in text.lower() for text in haystacks if text):
                continue
        filtered.append(record)

    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    items = filtered[start:end]
    has_next = end < total

    return AlertHistoryResponse(
        items=[AlertHistoryItem.from_orm(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        has_next=has_next,
    )


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.post("/alerts/history", response_model=AlertHistoryItem, status_code=201)
def create_alert_history(
    entry: AlertHistoryCreate,
    db: Session = Depends(deps.get_db_session),
) -> AlertHistoryItem:
    summary = entry.summary or AlertDeliveryHistory.build_summary(entry.payload)
    record = AlertDeliveryHistory(
        user_id=entry.user_id.strip(),
        source=entry.source.strip().lower(),
        source_id=entry.source_id.strip() if entry.source_id else None,
        title=entry.title.strip(),
        summary=summary.strip() if isinstance(summary, str) else None,
        severity=entry.severity.strip().lower() if entry.severity else None,
        channels=entry.channels or {},
        triggered_at=_ensure_utc(entry.triggered_at),
        payload=entry.payload,
    )
    if not record.summary:
        record.summary = record.title

    db.add(record)
    db.commit()
    db.refresh(record)

    return AlertHistoryItem.from_orm(record)


@router.post("/regions", response_model=RegionResponse)
def create_region(
    region: RegionCreate,
    db: Session = Depends(deps.get_db_session),
) -> RegionResponse:
    geom = geojson_to_geometry(region.area_geojson)
    record = Region(
        user_id=region.user_id,
        name=region.name,
        area=geom,
        properties=region.properties,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return RegionResponse(
        id=record.id,
        user_id=record.user_id,
        name=record.name,
        area_geojson=region.area_geojson,
        properties=record.properties,
        created_at=record.created_at,
    )


@router.get("/regions/{user_id}", response_model=List[RegionResponse])
def list_regions(user_id: str, db: Session = Depends(deps.get_db_session)) -> List[RegionResponse]:
    regions = db.query(Region).filter(Region.user_id == user_id).all()
    payload: List[RegionResponse] = []
    for region in regions:
        payload.append(
            RegionResponse(
                id=region.id,
                user_id=region.user_id,
                name=region.name,
                area_geojson=geometry_to_geojson(region.area),
                properties=region.properties,
                created_at=region.created_at,
            )
        )
    return payload


@router.patch("/regions/{region_id}", response_model=RegionResponse)
def update_region(region_id: int, payload: RegionUpdate, db: Session = Depends(deps.get_db_session)) -> RegionResponse:
    record = db.get(Region, region_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Region not found")
    if payload.name is not None:
        record.name = payload.name
    if payload.properties is not None:
        record.properties = payload.properties
    db.add(record)
    db.commit()
    db.refresh(record)
    return RegionResponse(
        id=record.id,
        user_id=record.user_id,
        name=record.name,
        area_geojson=geometry_to_geojson(record.area),
        properties=record.properties,
        created_at=record.created_at,
    )


@router.delete("/regions/{region_id}", status_code=204)
def delete_region(region_id: int, db: Session = Depends(deps.get_db_session)) -> None:
    record = db.get(Region, region_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Region not found")
    db.delete(record)
    db.commit()
