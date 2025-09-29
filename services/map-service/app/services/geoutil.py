from typing import Any, Dict

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping, shape


def _extract_geometry(geojson: Dict[str, Any]) -> Dict[str, Any]:
    if geojson.get("type") == "Feature":
        return geojson.get("geometry", {})
    return geojson


def geojson_to_geometry(geojson: Dict[str, Any], srid: int = 4326):
    geometry = _extract_geometry(geojson)
    return from_shape(shape(geometry), srid=srid)


def geometry_to_geojson(geometry) -> Dict[str, Any]:
    return mapping(to_shape(geometry))
