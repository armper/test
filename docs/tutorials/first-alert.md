# Send Your First Alert

This tutorial walks you through the full lifecycle of configuring an area, creating a custom condition, and triggering a notification. You will interact with the web dashboard and run a single API call to fire the evaluation so you do not have to wait for the background scheduler.

## Prerequisites
- Complete the [Quickstart](../getting-started.md) so Docker Compose is running and the dashboard is reachable at `http://localhost:3000`.
- Sign in as the seeded admin user (`admin / admin123`) or register a new account on the login page.

## Step 1 — Add an area to watch
1. From the dashboard, press **Manage areas** (or open the **Areas** tab).
2. Click **New area** ➜ **Draw on map** and outline a polygon around a city you care about.
3. Give the area a memorable name (e.g., “Downtown Coverage”) and press **Save area**.
4. The area now appears in your dashboard and will be used for alert matching.

*Tip:* If you prefer a shortcut, use **Import GeoJSON** and paste a polygon feature—`services/map-service/app/data/cities.geojson` includes sample coordinates you can adapt.

## Step 2 — Create a custom condition alert
1. Navigate to **Custom alerts**.
2. Choose **New custom alert**. Provide:
   - A friendly label, such as “Heat index heads-up”.
   - `temperature_hot` as the condition type.
   - A threshold (e.g., `90 °F`).
   - The map location near the area you created (use the pin or pick from **Saved areas**).
3. Save the alert. It now appears in your list with its cooldown window and last-triggered timestamp.

## Step 3 — Trigger an evaluation on demand
The custom alerts service evaluates rules every 10 minutes by default. Run it immediately with a `curl` call through the API gateway:
```bash
curl -sS -X POST \
  "http://localhost:8088/custom-alerts/api/v1/conditions/run?dry_run=true" \
  | jq
```
- A response such as `{ "triggered": 1 }` confirms at least one alert would fire.
- Switch `dry_run=false` to publish a real dispatch event onto Kafka and downstream workers.

## Step 4 — Inspect what happened
- Watch the router in real time: `docker compose logs -f notification-router-service`.
- Visit Kafka UI (`http://localhost:8085`) and open the `notify.dispatch.request.v1` topic to see the payload.
- In the dashboard, your custom alert now shows an updated “Last triggered” timestamp.

## Step 5 — Explore further
- Add additional areas for different regions and repeat the steps to compare coverage.
- Try other conditions (`temperature_cold`, `wind_speed_high`, `precipitation_heavy`) to see how the dispatcher routes per-channel preferences.
- Connect an external integration by replacing the mock SMS or email worker and rerunning the evaluation with `dry_run=false`.

You have now experienced the end-to-end flow—keep going by customizing schemas, adding analytics, or extending the frontend with new alert views.
