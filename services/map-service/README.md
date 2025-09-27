# Map Service

Provides geospatial utilities for the frontend, including city catalogues and persistent user-defined polygons stored in PostGIS.

## Running Locally

```bash
pip install -r requirements.txt
export MAP_SERVICE_DATABASE_URI=postgresql+psycopg2://user:password@localhost:5432/map_service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8003
```

OpenAPI docs available at `http://localhost:8003/docs`.
