import type { Feature } from 'geojson';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { LatLngLiteral } from 'leaflet';
import MapEditor from './MapEditor';
import LocationPicker from './LocationPicker';
import ForecastPreview from './ForecastPreview';
import { useToast } from '../context/ToastContext';
import {
  ConditionSubscription,
  ConditionSubscriptionCreatePayload,
  ConditionSubscriptionUpdatePayload,
  createConditionSubscription,
  updateConditionSubscription,
  createRegion,
  type Region,
} from '../services/api';

const CONDITION_CONFIG: Record<
  ConditionSubscription['condition_type'],
  {
    label: string;
    helper: string;
    unit: string;
    defaultThreshold: number;
    comparison: 'above' | 'below';
  }
> = {
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

const COOLDOWN_OPTIONS = [
  { label: 'Every time it happens', value: 0 },
  { label: 'Wait 1 hour between alerts', value: 60 },
  { label: 'Wait 3 hours between alerts', value: 180 },
  { label: 'Wait 6 hours between alerts', value: 360 },
  { label: 'Wait 12 hours between alerts', value: 720 },
  { label: 'Wait 24 hours between alerts', value: 1440 },
];

interface CustomAlertFormProps {
  userId: string;
  initialLocation: LatLngLiteral;
  regions: Region[];
  alert?: ConditionSubscription;
  onSaved: () => void;
  onCancel: () => void;
  onRegionCreated?: (region: Region) => void;
  saveLabel?: string;
}

interface FormState {
  condition_type: ConditionSubscription['condition_type'];
  label: string;
  threshold_value: number;
  latitude: number;
  longitude: number;
  selectedRegionId: number | 'custom';
  cooldownMinutes: number;
}

const CustomAlertForm = ({
  userId,
  initialLocation,
  regions,
  alert,
  onSaved,
  onCancel,
  onRegionCreated = () => {},
  saveLabel = 'Save alert',
}: CustomAlertFormProps) => {
  const defaults = useMemo<FormState>(() => {
    if (alert) {
      const metadata = (alert as any).metadata_json ?? (alert as any).metadata ?? {};
      return {
        condition_type: alert.condition_type,
        label: alert.label,
        threshold_value: alert.threshold_value,
        latitude: alert.latitude,
        longitude: alert.longitude,
        selectedRegionId: 'custom',
        cooldownMinutes: metadata.cooldown_minutes ?? 60,
      };
    }

    const startingType: FormState['condition_type'] = 'temperature_hot';
    const config = CONDITION_CONFIG[startingType];
    const defaultRegion = regions[0];
    const fallbackLat = defaultRegion ? extractRegionCenter(defaultRegion.area_geojson)?.lat : undefined;
    const fallbackLng = defaultRegion ? extractRegionCenter(defaultRegion.area_geojson)?.lng : undefined;

    return {
      condition_type: startingType,
      label: config.label,
      threshold_value: config.defaultThreshold,
      latitude: fallbackLat ?? initialLocation.lat,
      longitude: fallbackLng ?? initialLocation.lng,
      selectedRegionId: defaultRegion ? defaultRegion.id : 'custom',
      cooldownMinutes: 60,
    };
  }, [alert, initialLocation.lat, initialLocation.lng, regions]);

  const [form, setForm] = useState<FormState>(defaults);
  const [availableRegions, setAvailableRegions] = useState<Region[]>(regions);
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [draftFeature, setDraftFeature] = useState<Feature | null>(null);
  const [areaName, setAreaName] = useState('');
  const [areaDescription, setAreaDescription] = useState('');
  const [creatingRegion, setCreatingRegion] = useState(false);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const config = CONDITION_CONFIG[form.condition_type];

  useEffect(() => {
    setAvailableRegions(regions);
  }, [regions]);

  useEffect(() => {
    setForm(defaults);
    setIsCreatingArea(false);
    setDraftFeature(null);
    setAreaName('');
    setAreaDescription('');
    setAreaError(null);
    setError(null);
  }, [defaults]);

  const updateForm = (updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleConditionChange = (value: FormState['condition_type']) => {
    const next = CONDITION_CONFIG[value];
    updateForm({ condition_type: value, label: next.label, threshold_value: next.defaultThreshold });
  };

  const handleLocationChange = (coords: LatLngLiteral) => {
    updateForm({ latitude: coords.lat, longitude: coords.lng, selectedRegionId: 'custom' });
  };

  const handleRegionSelect = (value: string) => {
    if (value === 'custom') {
      setIsCreatingArea(false);
      setDraftFeature(null);
      updateForm({ selectedRegionId: 'custom' });
      return;
    }

    const id = Number(value);
    const region = availableRegions.find((item) => item.id === id);
    if (!region) return;

    const center = extractRegionCenter(region.area_geojson) ?? { lat: form.latitude, lng: form.longitude };
    setIsCreatingArea(false);
    setDraftFeature(null);
    updateForm({ selectedRegionId: id, latitude: center.lat, longitude: center.lng });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isCreatingArea) {
      setAreaError('Finish saving the new area or cancel drawing before saving this alert.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const metadata = form.cooldownMinutes > 0 ? { cooldown_minutes: form.cooldownMinutes } : undefined;

      if (alert) {
        const payload: ConditionSubscriptionUpdatePayload = {
          label: form.label,
          threshold_value: form.threshold_value,
          threshold_unit: alert.threshold_unit,
          comparison: alert.comparison,
          metadata,
          latitude: form.latitude,
          longitude: form.longitude,
        };
        await updateConditionSubscription(alert.id, payload);
      } else {
        const payload: ConditionSubscriptionCreatePayload = {
          user_id: userId,
          condition_type: form.condition_type,
          label: form.label,
          threshold_value: form.threshold_value,
          latitude: form.latitude,
          longitude: form.longitude,
          metadata,
        };
        await createConditionSubscription(payload);
      }

      onSaved();
    } catch (err) {
      console.error(err);
      setError('We could not save that alert. Please try again.');
      showToast('Saving the alert failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartArea = () => {
    setIsCreatingArea(true);
    setDraftFeature(null);
    setAreaError(null);
  };

  const handleCancelArea = () => {
    setIsCreatingArea(false);
    setDraftFeature(null);
    setAreaName('');
    setAreaDescription('');
    setAreaError(null);
  };

  const handleDraftFeature = (feature: Feature) => {
    if (!feature?.geometry) {
      setAreaError('Draw a polygon to define your area.');
      return;
    }
    setAreaError(null);
    setDraftFeature(feature);
  };

  const handleSaveArea = async () => {
    if (!draftFeature?.geometry) {
      setAreaError('Draw a polygon to define your area before saving.');
      return;
    }

    setCreatingRegion(true);
    setAreaError(null);

    try {
      const trimmedName = areaName.trim();
      const trimmedDescription = areaDescription.trim();
      const properties: Record<string, unknown> = { receive_alerts: true };
      if (trimmedDescription) {
        properties.description = trimmedDescription;
      }

      const created = await createRegion({
        user_id: userId,
        name: trimmedName || undefined,
        area_geojson: draftFeature.geometry,
        properties,
      });

      setAvailableRegions((prev) => {
        if (prev.some((region) => region.id === created.id)) {
          return prev;
        }
        return [...prev, created];
      });
      onRegionCreated(created);

      const center = extractRegionCenter(created.area_geojson) ?? {
        lat: form.latitude,
        lng: form.longitude,
      };

      setForm((prev) => ({
        ...prev,
        selectedRegionId: created.id,
        latitude: center.lat,
        longitude: center.lng,
      }));

      setIsCreatingArea(false);
      setDraftFeature(null);
      setAreaName('');
      setAreaDescription('');
      showToast('Area saved. You can now reuse it for alerts.', 'success');
    } catch (err) {
      console.error(err);
      setAreaError('We could not save that area. Please try again.');
      showToast('Saving the new area failed.', 'error');
    } finally {
      setCreatingRegion(false);
    }
  };

  const selectedRegion =
    form.selectedRegionId === 'custom'
      ? undefined
      : availableRegions.find((item) => item.id === form.selectedRegionId);

  return (
    <form className="condition-form" onSubmit={handleSubmit}>
      <fieldset className="fieldset">
        <legend>1. Choose where to watch</legend>
        <div className="field">
          <label htmlFor="saved-area">Saved areas</label>
          <select
            id="saved-area"
            value={form.selectedRegionId}
            onChange={(event) => handleRegionSelect(event.target.value)}
          >
            <option value="custom">Drop a pin manually</option>
            {availableRegions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name ?? 'Custom area'}
              </option>
            ))}
          </select>
          <small>Select one of your saved areas or tap the map below to drop a marker.</small>
          <button
            type="button"
            onClick={isCreatingArea ? handleCancelArea : handleStartArea}
            className="action secondary"
          >
            {isCreatingArea ? 'Cancel drawing' : 'Draw a new area'}
          </button>
        </div>

        {isCreatingArea ? (
          <>
            <MapEditor center={[form.latitude, form.longitude]} onSave={handleDraftFeature} />
            <p className="helper">Draw a polygon on the map, then save it as a reusable area.</p>
            <div className="field">
              <label htmlFor="area-name">Area name</label>
              <input
                id="area-name"
                value={areaName}
                onChange={(event) => setAreaName(event.target.value)}
                placeholder="My coverage area"
              />
            </div>
            <div className="field">
              <label htmlFor="area-description">Description (optional)</label>
              <textarea
                id="area-description"
                value={areaDescription}
                onChange={(event) => setAreaDescription(event.target.value)}
                rows={3}
              />
            </div>
            {areaError && <p className="error">{areaError}</p>}
            <div className="form-actions">
              <button type="button" className="action secondary" onClick={handleCancelArea} disabled={creatingRegion}>
                Cancel
              </button>
              <button
                type="button"
                className="action"
                onClick={handleSaveArea}
                disabled={creatingRegion || !draftFeature}
              >
                {creatingRegion ? 'Saving…' : 'Save area'}
              </button>
            </div>
          </>
        ) : (
          <>
            <LocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={handleLocationChange}
              highlight={selectedRegion?.area_geojson}
            />

            <ForecastPreview latitude={form.latitude} longitude={form.longitude} />

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
          </>
        )}
      </fieldset>

      <fieldset className="fieldset">
        <legend>2. Decide when to alert you</legend>
        <div className="field">
          <label htmlFor="condition-type">Alert type</label>
          <select
            id="condition-type"
            value={form.condition_type}
            onChange={(event) => handleConditionChange(event.target.value as FormState['condition_type'])}
            disabled={!!alert}
          >
            {Object.entries(CONDITION_CONFIG).map(([value, info]) => (
              <option key={value} value={value}>
                {info.label}
              </option>
            ))}
          </select>
          <small>{config.helper}</small>
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
          <small>{config.unit}</small>
        </div>
        <div className="field">
          <label htmlFor="cooldown">Remind me again after</label>
          <select
            id="cooldown"
            value={form.cooldownMinutes}
            onChange={(event) => updateForm({ cooldownMinutes: Number(event.target.value) })}
          >
            {COOLDOWN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="action secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="action" disabled={submitting || isCreatingArea}>
          {submitting ? 'Saving…' : saveLabel}
        </button>
      </div>
    </form>
  );
};

export default CustomAlertForm;

function extractRegionCenter(geojson: any): LatLngLiteral | null {
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
}

function normalizeGeoJson(input: any): Feature | null {
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
}

function averageCoords(points: number[][]): [number, number] {
  const total = points.reduce<[number, number]>((acc, [lng, lat]) => {
    acc[0] += lng;
    acc[1] += lat;
    return acc;
  }, [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}
