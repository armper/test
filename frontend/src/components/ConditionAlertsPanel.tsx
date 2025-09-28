import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { LatLngLiteral } from 'leaflet';
import {
  ConditionSubscription,
  ConditionSubscriptionCreatePayload,
  createConditionSubscription,
  deleteConditionSubscription,
  listConditionSubscriptions,
  runConditionEvaluation,
  fetchRegions,
  type Region,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import LocationPicker from './LocationPicker';

const CONDITION_CONFIG: Record<ConditionSubscription['condition_type'], {
  label: string;
  helper: string;
  unit: string;
  defaultThreshold: number;
  comparison: 'above' | 'below';
}> = {
  temperature_hot: {
    label: "Let me know when it's really hot",
    helper: 'Great for planning outdoor time when the day heats up.',
    unit: '°F',
    defaultThreshold: 85,
    comparison: 'above',
  },
  temperature_cold: {
    label: "Give me a heads-up when it's cold",
    helper: 'Never forget a coat again when the temperature drops.',
    unit: '°F',
    defaultThreshold: 32,
    comparison: 'below',
  },
  precipitation: {
    label: 'Ping me when rain is likely',
    helper: 'Perfect for remembering umbrellas and rescheduling plans.',
    unit: '% chance',
    defaultThreshold: 40,
    comparison: 'above',
  },
  wind: {
    label: 'Warn me when it gets very windy',
    helper: 'Great for runners, cyclists, and patio planners.',
    unit: 'mph',
    defaultThreshold: 25,
    comparison: 'above',
  },
};

interface FormState {
  condition_type: ConditionSubscription['condition_type'];
  label: string;
  threshold_value: number;
  latitude: number;
  longitude: number;
}

const ConditionAlertsPanel = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ConditionSubscription[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<number | 'custom'>('custom');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluationCount, setEvaluationCount] = useState<number | null>(null);

  const initialLocation = useMemo(() => {
    const fallback = { lat: 40.7128, lng: -74.006 };
    const defaults = user?.default_location as { lat?: number; lng?: number } | undefined;
    return {
      lat: defaults?.lat ?? fallback.lat,
      lng: defaults?.lng ?? fallback.lng,
    };
  }, [user]);

  const [form, setForm] = useState<FormState>(() => {
    const startingType: FormState['condition_type'] = 'temperature_hot';
    const config = CONDITION_CONFIG[startingType];
    return {
      condition_type: startingType,
      label: config.label,
      threshold_value: config.defaultThreshold,
      latitude: initialLocation.lat,
      longitude: initialLocation.lng,
    };
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      latitude: initialLocation.lat,
      longitude: initialLocation.lng,
    }));
  }, [initialLocation.lat, initialLocation.lng]);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      setRegions([]);
      return;
    }

    setLoading(true);
    Promise.all([
      listConditionSubscriptions(user.id.toString()),
      fetchRegions(user.id.toString()),
    ])
      .then(([alertItems, regionItems]) => {
        setAlerts(alertItems);
        setRegions(regionItems);
        if (regionItems.length && selectedRegionId === 'custom') {
          const center = extractRegionCenter(regionItems[0].area_geojson);
          if (center) {
            setSelectedRegionId(regionItems[0].id);
            setForm((prev) => ({ ...prev, latitude: center.lat, longitude: center.lng }));
          }
        }
      })
      .catch(() => setError('Unable to load custom alerts right now.'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (selectedRegionId === 'custom') return;
    const region = regions.find((item) => item.id === selectedRegionId);
    if (!region) return;
    const center = extractRegionCenter(region.area_geojson);
    if (center) {
      setForm((prev) => ({ ...prev, latitude: center.lat, longitude: center.lng }));
    }
  }, [selectedRegionId, regions]);

  const updateForm = (updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleConditionChange = (value: FormState['condition_type']) => {
    const config = CONDITION_CONFIG[value];
    updateForm({
      condition_type: value,
      label: config.label,
      threshold_value: config.defaultThreshold,
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    const payload: ConditionSubscriptionCreatePayload = {
      user_id: user.id.toString(),
      condition_type: form.condition_type,
      label: form.label,
      threshold_value: form.threshold_value,
      latitude: form.latitude,
      longitude: form.longitude,
    };

    try {
      await createConditionSubscription(payload);
      const updated = await listConditionSubscriptions(user.id.toString());
      setAlerts(updated);
      setMessage('Saved! We will keep an eye on that for you.');
    } catch (err) {
      console.error(err);
      setError('We could not save that alert. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!user) return;
    setError(null);
    try {
      await deleteConditionSubscription(id);
      const updated = await listConditionSubscriptions(user.id.toString());
      setAlerts(updated);
      setMessage('Alert removed.');
    } catch (err) {
      console.error(err);
      setError('Unable to remove that alert right now.');
    }
  };

  const handleEvaluate = async () => {
    setEvaluationCount(null);
    setError(null);
    try {
      const result = await runConditionEvaluation(true);
      setEvaluationCount(result.triggered);
    } catch (err) {
      console.error(err);
      setError('We could not run a quick check. Try again in a moment.');
    }
  };

  const handleLocationChange = (coords: LatLngLiteral) => {
    updateForm({ latitude: coords.lat, longitude: coords.lng });
    setSelectedRegionId('custom');
  };

  if (!user) {
    return null;
  }

  return (
    <section className="card">
      <header className="card-header">
        <h2>Everyday Weather Alerts</h2>
        <p>Choose a spot, pick a condition, and we’ll nudge you when it happens.</p>
      </header>

      <form className="condition-form" onSubmit={handleSubmit}>
        <fieldset className="fieldset">
          <legend>1. Choose where to watch</legend>
          <div className="field">
            <label htmlFor="saved-area">Saved areas</label>
            <select
              id="saved-area"
              value={selectedRegionId}
              onChange={(event) => {
                const value = event.target.value === 'custom' ? 'custom' : Number(event.target.value);
                setSelectedRegionId(value);
              }}
            >
              <option value="custom">Drop a pin manually</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name ?? 'Custom area'}
                </option>
              ))}
            </select>
            <small>Select one of your saved areas or tap the map to drop a marker.</small>
          </div>

          <LocationPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={handleLocationChange}
          />

          <div className="location-summary">
            <div>
              <strong>Latitude</strong>
              <span>{form.latitude.toFixed(4)}</span>
            </div>
            <div>
              <strong>Longitude</strong>
              <span>{form.longitude.toFixed(4)}</span>
            </div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>2. Decide when to alert you</legend>
          <div className="field">
            <label htmlFor="condition-type">Alert type</label>
            <select
              id="condition-type"
              value={form.condition_type}
              onChange={(event) => handleConditionChange(event.target.value as FormState['condition_type'])}
            >
              {Object.entries(CONDITION_CONFIG).map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
            </select>
            <small>{CONDITION_CONFIG[form.condition_type].helper}</small>
          </div>

          <div className="field">
            <label htmlFor="condition-label">Friendly name</label>
            <input
              id="condition-label"
              value={form.label}
              onChange={(event) => updateForm({ label: event.target.value })}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="threshold">Notify me when it reaches</label>
            <input
              id="threshold"
              type="number"
              value={form.threshold_value}
              onChange={(event) => updateForm({ threshold_value: Number(event.target.value) })}
              required
              min={-150}
              max={200}
            />
            <small>{CONDITION_CONFIG[form.condition_type].unit}</small>
          </div>
        </fieldset>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save alert'}
        </button>
      </form>

      <div className="condition-feedback">
        {loading && <p>Loading your alert preferences…</p>}
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="condition-actions">
        <button type="button" onClick={handleEvaluate}>
          Check my alerts now
        </button>
        {evaluationCount !== null && (
          <span className="pill">{evaluationCount} alert{evaluationCount === 1 ? '' : 's'} would fire</span>
        )}
      </div>

      <ul className="condition-list">
        {alerts.map((alert) => {
          const config = CONDITION_CONFIG[alert.condition_type];
          return (
            <li key={alert.id} className="condition-item">
              <div>
                <h3>{alert.label}</h3>
                <p>
                  {config ? config.helper : 'Custom alert'} — we will notify you when the threshold of{' '}
                  <strong>
                    {alert.threshold_value} {config ? config.unit : alert.threshold_unit}
                  </strong>{' '}
                  is {alert.comparison === 'above' ? 'reached or higher' : 'reached or lower'}.
                </p>
                <p className="meta">
                  Watching point at {alert.latitude.toFixed(3)}, {alert.longitude.toFixed(3)}
                  {alert.last_triggered_at ? ` · last triggered ${new Date(alert.last_triggered_at).toLocaleString()}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => handleDelete(alert.id)}>
                Remove
              </button>
            </li>
          );
        })}
        {alerts.length === 0 && !loading && <li>No custom condition alerts yet — add your first one above.</li>}
      </ul>
    </section>
  );
};

export default ConditionAlertsPanel;

function extractRegionCenter(geojson: any): LatLngLiteral | null {
  if (!geojson) return null;
  const geometry = geojson.type ? geojson : { type: 'Feature', geometry: geojson };
  const type = geometry.type === 'Feature' ? geometry.geometry.type : geometry.type;
  const coordinates = geometry.type === 'Feature' ? geometry.geometry.coordinates : geometry.coordinates;

  if (!Array.isArray(coordinates)) return null;

  if (type === 'MultiPolygon') {
    const polygon = coordinates[0]?.[0];
    if (Array.isArray(polygon) && polygon.length) {
      const [lng, lat] = averageCoords(polygon);
      return { lat, lng };
    }
  }

  if (type === 'Polygon') {
    const ring = coordinates[0];
    if (Array.isArray(ring) && ring.length) {
      const [lng, lat] = averageCoords(ring);
      return { lat, lng };
    }
  }

  return null;
}

function averageCoords(points: number[][]): [number, number] {
  const total = points.reduce<[number, number]>((acc, [lng, lat]) => {
    acc[0] += lng;
    acc[1] += lat;
    return acc;
  }, [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}
