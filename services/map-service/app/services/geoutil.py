from typing import Any, Dict

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping, shape


def geojson_to_geometry(geojson: Dict[str, Any], srid: int = 4326):
    return from_shape(shape(geojson), srid=srid)


def geometry_to_geojson(geometry) -> Dict[str, Any]:
    return mapping(to_shape(geometry))
