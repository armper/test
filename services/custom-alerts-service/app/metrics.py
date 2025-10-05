from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, generate_latest

router = APIRouter(include_in_schema=False)

alert_evaluations_total = Counter(
    "custom_alert_evaluations_total",
    "Number of custom alert evaluations performed",
    labelnames=("tenant",),
)

alert_matches_total = Counter(
    "custom_alert_matches_total",
    "Number of custom alert matches triggered",
    labelnames=("tenant",),
)


@router.get("/metrics")
def metrics_endpoint() -> Response:
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
