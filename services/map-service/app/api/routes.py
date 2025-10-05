import json
from pathlib import Path
from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import CompileError
from sqlalchemy.orm import Session

from ..core import deps
from ..core.config import settings
from ..db.base import Base
from ..db.session import engine
from ..models.alert import Alert
from ..models.region import Region
from ..schemas import AlertSummary, RegionCreate, RegionResponse, RegionUpdate
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
