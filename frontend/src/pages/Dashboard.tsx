import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { Feature } from 'geojson';
import type { LatLngLiteral } from 'leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchAlerts, fetchRegions, listConditionSubscriptions, type Region, type ConditionSubscription } from '../services/api';
import { clearMutedAlerts, loadMutedAlerts, loadPinnedAreas, muteAlert, togglePinnedArea } from '../utils/storage';

interface AlertItem {
  id: number;
  title: string;
  severity?: string;
  event?: string;
  sent: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [mutedAlerts, setMutedAlerts] = useState(() => loadMutedAlerts());
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [pinnedRegions, setPinnedRegions] = useState<number[]>(() => loadPinnedAreas());
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [customAlerts, setCustomAlerts] = useState<ConditionSubscription[]>([]);
  const [customAlertsLoading, setCustomAlertsLoading] = useState(false);
  const [customAlertsError, setCustomAlertsError] = useState<string | null>(null);

  const loadAlerts = useCallback(() => {
    fetchAlerts()
      .then((items) => {
        const filtered = items.filter((alert) => !mutedAlerts.some((entry) => entry.id === String(alert.id)));
        setAlerts(filtered);
        if (!filtered.length) {
          setAlertsError(items.length ? 'Muted alerts are hidden. Clear to view again.' : 'No NOAA alerts in your watchlist right now.');
        } else {
          setAlertsError(null);
        }
      })
      .catch((error) => {
        console.error(error);
        setAlertsError('We could not load NOAA alerts.');
        showToast('We could not load NOAA alerts.', 'error');
      });
  }, [mutedAlerts, showToast]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (!user) {
      setCustomAlerts([]);
      return;
    }
    setCustomAlertsLoading(true);
    listConditionSubscriptions(user.id.toString())
      .then((items) => {
        setCustomAlerts(items);
        setCustomAlertsError(null);
      })
      .catch((error) => {
        console.error(error);
        setCustomAlertsError('Unable to load your custom alerts right now.');
      })
      .finally(() => setCustomAlertsLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setRegions([]);
      setSelectedRegionId(null);
      return;
    }
    setRegionsLoading(true);
    fetchRegions(user.id.toString())
      .then((items) => {
        setRegions(items);
        if (!items.length) {
          setSelectedRegionId(null);
        } else if (selectedRegionId === null || !items.some((region) => region.id === selectedRegionId)) {
          const pinnedFirst = items.find((region) => pinnedRegions.includes(region.id));
          setSelectedRegionId(pinnedFirst ? pinnedFirst.id : items[0].id);
        }
        setRegionsError(null);
      })
      .catch((error) => {
        console.error(error);
        setRegionsError('We could not load your saved areas.');
      })
      .finally(() => setRegionsLoading(false));
  }, [user, pinnedRegions, selectedRegionId]);

  const handleSelectRegion = (region: Region) => {
    setSelectedRegionId(region.id);
  };

  const handleTogglePinned = (region: Region) => {
    const updated = togglePinnedArea(region.id);
    setPinnedRegions(updated);
    setSelectedRegionId((prev) => (prev ?? region.id));
    showToast(updated.includes(region.id) ? 'Pinned to your dashboard.' : 'Unpinned from your dashboard.', 'info');
  };

  const sortedRegions = useMemo(() => {
    if (!regions.length) return [];
    const pinnedOrder = new Map(pinnedRegions.map((id, index) => [id, index]));
    const items = [...regions];
    return items
      .sort((a, b) => {
        const aPinned = pinnedOrder.has(a.id);
        const bPinned = pinnedOrder.has(b.id);
        if (aPinned && bPinned) {
          return (pinnedOrder.get(a.id) ?? 0) - (pinnedOrder.get(b.id) ?? 0);
        }
        if (aPinned) return -1;
        if (bPinned) return 1;
        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        if (bDate !== aDate) {
          return bDate - aDate;
        }
        const aName = (a.name ?? 'Custom area').toLowerCase();
        const bName = (b.name ?? 'Custom area').toLowerCase();
        return aName.localeCompare(bName);
      })
      .slice(0, 6);
  }, [regions, pinnedRegions]);

  const selectedRegion = useMemo(() => {
    if (selectedRegionId == null) return null;
    return regions.find((region) => region.id === selectedRegionId) ?? null;
  }, [regions, selectedRegionId]);

  const mapFeatures = useMemo(() => {
    return regions.map((region) => ({ region, feature: regionToFeature(region) }));
  }, [regions]);

  const selectedFeature = useMemo(() => regionToFeature(selectedRegion), [selectedRegion]);

  const fallbackFeatures = useMemo(
    () =>
      mapFeatures
        .map((item) => item.feature)
        .filter((feature): feature is Feature => Boolean(feature)),
    [mapFeatures],
  );

  const handleMute = (alert: AlertItem, hours = 24) => {
    const updated = muteAlert(String(alert.id), hours);
    setMutedAlerts(updated);
    setAlerts((prev) => prev.filter((item) => item.id !== alert.id));
    showToast(`Muted "${alert.title}" for ${hours} hour${hours === 1 ? '' : 's'}.`, 'info');
  };

  const handleClearMuted = () => {
    clearMutedAlerts();
    setMutedAlerts([]);
    showToast('Cleared muted alerts.', 'info');
    loadAlerts();
  };

  const topCustomAlerts = useMemo(() => customAlerts.slice(0, 4), [customAlerts]);

  return (
    <div className="page-section">
      <div className="section-header">
        <div>
          <h2>Welcome back{user?.full_name ? `, ${user.full_name}` : ''}</h2>
          <p>Stay up to date on the weather stories that matter to you.</p>
        </div>
        <div className="quick-actions">
          <Link to="/custom-alerts" className="action">
            Custom alerts
          </Link>
          <Link to="/areas" className="action secondary">
            Manage areas
          </Link>
        </div>
      </div>

      <section className="card">
        <header className="section-subheader">
          <h3>Your custom alerts</h3>
          <span>{customAlerts.length} active</span>
        </header>
        {customAlertsError && <p className="error">{customAlertsError}</p>}
        {customAlertsLoading ? (
          <p>Loading custom alerts…</p>
        ) : customAlerts.length === 0 ? (
          <div className="empty-state">
            <p>You don’t have any custom alerts yet. Create one to get tailored notifications.</p>
            <Link to="/custom-alerts" className="action">
              Create a custom alert
            </Link>
          </div>
        ) : (
          <div className="custom-alerts-overview">
            <ul>
              {topCustomAlerts.map((alert) => (
                <li key={alert.id}>
                  <div>
                    <strong>{alert.label}</strong>
                    <p>
                      Watching {alert.latitude.toFixed(2)}, {alert.longitude.toFixed(2)} — {alert.condition_type.replace('_', ' ')}{' '}
                      at {alert.threshold_value}
                      {alert.threshold_unit ?? ''}
                    </p>
                  </div>
                  <Link to="/custom-alerts" className="link-inline">
                    Manage
                  </Link>
                </li>
              ))}
            </ul>
            {customAlerts.length > topCustomAlerts.length ? (
              <Link to="/custom-alerts" className="link-inline">
                View all alerts →
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <section className="card">
        <header className="section-subheader">
          <h3>Active NOAA Alerts</h3>
          <span>{alerts.length} currently impacting your watchlist</span>
        </header>
        {mutedAlerts.length > 0 && (
          <div className="muted-banner">
            <span>{mutedAlerts.length} alert{mutedAlerts.length === 1 ? '' : 's'} muted</span>
            <button type="button" onClick={handleClearMuted}>
              Clear
            </button>
          </div>
        )}
        {alerts.length > 0 ? (
          <div className="card-grid">
            {alerts.map((alert) => (
              <article key={alert.id} className={`card-item severity-${alert.severity?.toLowerCase() ?? 'unknown'}`}>
                <div className="card-item-body">
                  <h4>{alert.title}</h4>
                  <p>{alert.event}</p>
                  <span>{new Date(alert.sent).toLocaleString()}</span>
                </div>
                <div className="item-actions">
                  <button type="button" onClick={() => handleMute(alert, 24)}>
                    Mute 24h
                  </button>
                  <button type="button" onClick={() => handleMute(alert, 168)}>
                    Mute 7d
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>{alertsError ?? 'No active alerts in your saved regions right now.'}</p>
        )}
      </section>

      <section className="card">
        <header className="section-subheader">
          <h3>Your coverage overview</h3>
          <span>{regions.length} saved area{regions.length === 1 ? '' : 's'}</span>
        </header>
        {regionsError && <p className="error">{regionsError}</p>}
        {regionsLoading && <p>Loading areas…</p>}
        {!regionsLoading && regions.length === 0 && <p>You haven’t drawn any areas yet — head to the Areas tab to create one.</p>}
        {!regionsLoading && regions.length > 0 && (
          <div className="dashboard-map">
            <div className="map-shell">
              <MapContainer
                key={`dashboard-map-${regions.length}`}
                center={[37.8, -96]}
                zoom={4}
                style={{ height: '360px', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapFeatures
                  .filter((entry) => entry.feature)
                  .map(({ region, feature }) => (
                  <GeoJSON
                    key={region.id}
                    data={feature as Feature}
                    style={{
                      color: region.id === selectedRegion?.id ? '#38bdf8' : 'rgba(148, 163, 184, 0.6)',
                      weight: region.id === selectedRegion?.id ? 3 : 1.5,
                      fillOpacity: region.id === selectedRegion?.id ? 0.2 : 0.08,
                    }}
                    eventHandlers={{
                      click: () => handleSelectRegion(region),
                    }}
                  />
                ))}
                <MapFocus feature={selectedFeature} fallbackFeatures={fallbackFeatures} />
              </MapContainer>
            </div>
            <aside className="map-sidebar">
              <header className="sidebar-header">
                <h4>Top areas</h4>
                <span>{pinnedRegions.length} pinned</span>
              </header>
              <ul className="sidebar-list">
                {sortedRegions.map((region) => {
                  const name = region.name ?? 'Custom area';
                  const properties = (region.properties ?? {}) as Record<string, unknown>;
                  const description = (properties.description as string) ?? 'No description provided.';
                  const isPinned = pinnedRegions.includes(region.id);
                  const isActive = region.id === selectedRegionId;
                  const center = extractRegionCenter(region.area_geojson);
                  return (
                    <li key={region.id} className={`sidebar-item${isActive ? ' is-active' : ''}`}>
                      <button type="button" onClick={() => handleSelectRegion(region)} className="sidebar-item-button">
                        <div>
                          <strong>{name}</strong>
                          <p>{description}</p>
                          {center ? (
                            <span className="meta">
                              {center.lat.toFixed(2)}, {center.lng.toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`pin-button${isPinned ? ' pinned' : ''}`}
                        onClick={() => handleTogglePinned(region)}
                        aria-label={isPinned ? 'Unpin area' : 'Pin area'}
                      >
                        {isPinned ? 'Pinned' : 'Pin'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
          </div>
        )}
      </section>

      <section className="card highlights">
        <h3>Boost your weather awareness</h3>
        <div className="highlight-grid">
          <div>
            <h4>Everyday reminders</h4>
            <p>Get nudges when it gets too hot, too cold, too windy, or too rainy.</p>
            <Link to="/custom-alerts" className="link-inline">
              Set up a custom alert →
            </Link>
          </div>
          <div>
            <h4>Shape your map</h4>
            <p>Draw neighborhoods and travel routes so we watch the right places.</p>
            <Link to="/areas" className="link-inline">
              Edit saved areas →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

const MapFocus = ({ feature, fallbackFeatures }: { feature: Feature | null; fallbackFeatures: Feature[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const targets = feature ? [feature] : fallbackFeatures;
    if (!targets.length) return;

    const layers = targets.map((item) => L.geoJSON(item));
    const group = L.featureGroup(layers);
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18));
    }
    return () => {
      group.remove();
    };
  }, [map, feature, fallbackFeatures]);

  return null;
};

const regionToFeature = (region?: Region | null): Feature | null => {
  if (!region) return null;
  return normalizeGeoJson(region.area_geojson);
};

const normalizeGeoJson = (input: any): Feature | null => {
  if (!input) return null;

  if (input.type === 'FeatureCollection') {
    const first = input.features?.[0];
    return first ? normalizeGeoJson(first) : null;
  }

  if (input.type === 'Feature') {
    return input as Feature;
  }

  if (input.type && input.coordinates) {
    return {
      type: 'Feature',
      geometry: input,
      properties: {},
    } as Feature;
  }

  return null;
};

const extractRegionCenter = (geojson: any): LatLngLiteral | null => {
  const feature = normalizeGeoJson(geojson);
  if (!feature?.geometry) return null;

  const { type, coordinates } = feature.geometry as any;
  if (!Array.isArray(coordinates)) return null;

  if (type === 'Point') {
    const [lng, lat] = coordinates as [number, number];
    return { lat, lng };
  }

  if (type === 'MultiPolygon') {
    const polygon = coordinates[0]?.[0];
    if (Array.isArray(polygon) && polygon.length) {
      const [lng, lat] = averageCoords(polygon as number[][]);
      return { lat, lng };
    }
  }

  if (type === 'Polygon') {
    const ring = coordinates[0];
    if (Array.isArray(ring) && ring.length) {
      const [lng, lat] = averageCoords(ring as number[][]);
      return { lat, lng };
    }
  }

  return null;
};

const averageCoords = (points: number[][]): [number, number] => {
  const total = points.reduce<[number, number]>((acc, [lng, lat]) => {
    acc[0] += lng;
    acc[1] += lat;
    return acc;
  }, [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
};

export default Dashboard;
