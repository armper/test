import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
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
    search_lower = search.lower() if search else None
    source_lower = source.lower() if source else None
    severity_lower = severity.lower() if severity else None
    channel_lower = channel.lower() if channel else None

    base_query = db.query(AlertDeliveryHistory).filter(AlertDeliveryHistory.user_id == user_id)

    bind = db.get_bind()
    dialect_name = getattr(getattr(bind, "dialect", None), "name", None)
    supports_json_filters = dialect_name == "postgresql"

    if source_lower:
        base_query = base_query.filter(func.lower(AlertDeliveryHistory.source) == source_lower)
    if severity_lower:
        base_query = base_query.filter(func.lower(AlertDeliveryHistory.severity) == severity_lower)
    if search_lower:
        pattern = f"%{search_lower}%"
        base_query = base_query.filter(
            or_(
                func.lower(AlertDeliveryHistory.title).like(pattern),
                func.lower(AlertDeliveryHistory.summary).like(pattern),
            )
        )
    if channel_lower and supports_json_filters:
        base_query = base_query.filter(AlertDeliveryHistory.channels.contains({channel_lower: True}))

    ordered_query = base_query.order_by(
        AlertDeliveryHistory.triggered_at.desc(),
        AlertDeliveryHistory.id.desc(),
    )

    start = (page - 1) * page_size
    end = start + page_size

    if channel_lower and not supports_json_filters:
        # Fallback to in-memory filtering when channel-specific filtering is requested to maintain
        # compatibility with both SQLite (tests) and PostgreSQL (production) backends.
        records = ordered_query.all()
        filtered = [
            record
            for record in records
            if channel_lower in {name.lower() for name in record.channel_list()}
        ]
        total = len(filtered)
        items = filtered[start:end]
    else:
        total = base_query.count()
        items = (
            ordered_query
            .offset(start)
            .limit(page_size)
            .all()
        )

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
