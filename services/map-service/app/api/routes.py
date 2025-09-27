import json
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core import deps
from ..core.config import settings
from ..db.base import Base
from ..db.session import engine
from ..models.region import Region
from ..schemas import RegionCreate, RegionResponse
from ..services.geoutil import geojson_to_geometry, geometry_to_geojson

router = APIRouter()


@router.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@router.get("/cities")
def list_cities() -> dict:
    path = Path(settings.DEFAULT_CITY_DATA)
    if not path.exists():
        raise HTTPException(status_code=500, detail="City dataset missing")
    return json.loads(path.read_text())


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
