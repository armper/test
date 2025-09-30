from typing import Any, Dict

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import MultiPolygon, mapping, shape


def _extract_geometry(geojson: Dict[str, Any]) -> Dict[str, Any]:
    if geojson.get("type") == "Feature":
        return geojson.get("geometry", {})
    return geojson


def geojson_to_geometry(geojson: Dict[str, Any], srid: int = 4326):
    geometry = _extract_geometry(geojson)
    shapely_geom = shape(geometry)
    if shapely_geom.geom_type == 'Polygon':
        shapely_geom = MultiPolygon([shapely_geom])
    return from_shape(shapely_geom, srid=srid)


def geometry_to_geojson(geometry) -> Dict[str, Any]:
    return mapping(to_shape(geometry))
