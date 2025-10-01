import type { Feature } from 'geojson';
import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngLiteral } from 'leaflet';
import L from 'leaflet';
import MapEditor from '../components/MapEditor';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createRegion,
  deleteRegion,
  fetchRegions,
  listCities,
  updateRegion,
  type CityFeature,
  type Region,
} from '../services/api';
import useBrowserLocation from '../hooks/useBrowserLocation';

const DEFAULT_CENTER: LatLngLiteral = { lat: 40.7128, lng: -74.006 };

const AreasPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<CityFeature[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [mode, setMode] = useState<'create' | 'view'>('create');

  const [draftNewFeature, setDraftNewFeature] = useState<Feature | null>(null);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDescription, setNewAreaDescription] = useState('');
  const [savingNewArea, setSavingNewArea] = useState(false);

  const [isEditingShape, setIsEditingShape] = useState(false);
  const [shapeDraft, setShapeDraft] = useState<Feature | null>(null);
  const [savingShape, setSavingShape] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [receiveAlerts, setReceiveAlerts] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [updatingAlerts, setUpdatingAlerts] = useState(false);

  const [confirmDeleteRegion, setConfirmDeleteRegion] = useState<Region | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchRegions(user.id.toString())
      .then((data) => {
        setRegions(data);
        if (data.length) {
          setMode('view');
          setSelectedRegionId(data[0].id);
        } else {
          setMode('create');
          setSelectedRegionId(null);
        }
      })
      .catch(() => setStatus('Unable to load regions.'));
  }, [user]);

  useEffect(() => {
    listCities()
      .then((data) => setCities(data.features ?? []))
      .catch(() => null);
  }, []);

  const { location: browserLocation } = useBrowserLocation(true);

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? null,
    [regions, selectedRegionId],
  );

  useEffect(() => {
    if (!selectedRegion) {
      setEditName('');
      setEditDescription('');
      setReceiveAlerts(true);
      setIsEditingShape(false);
      setShapeDraft(null);
      return;
    }

    setEditName(selectedRegion.name ?? '');
    const properties = (selectedRegion.properties ?? {}) as Record<string, unknown>;
    setEditDescription((properties.description as string) ?? '');
    setReceiveAlerts(properties.receive_alerts !== false);
    setIsEditingShape(false);
    setShapeDraft(null);
  }, [selectedRegion]);

  const previewFeature = useMemo(() => regionToFeature(selectedRegion), [selectedRegion]);

  const mapCenter = useMemo<LatLngLiteral>(() => {
    if (isEditingShape && shapeDraft) {
      return featureCenter(shapeDraft) ?? DEFAULT_CENTER;
    }

    if (mode === 'create' && draftNewFeature) {
      return featureCenter(draftNewFeature) ?? DEFAULT_CENTER;
    }

    if (previewFeature) {
      return featureCenter(previewFeature) ?? DEFAULT_CENTER;
    }

    if (browserLocation) {
      return browserLocation;
    }

    const location = user?.default_location as { lat?: number; lng?: number } | undefined;
    if (location?.lat && location?.lng) {
      return { lat: location.lat, lng: location.lng };
    }

    if (cities.length > 0) {
      return featureCenter(cities[0]) ?? DEFAULT_CENTER;
    }

    return DEFAULT_CENTER;
  }, [
    browserLocation,
    cities,
    draftNewFeature,
    isEditingShape,
    mode,
    previewFeature,
    shapeDraft,
    user,
  ]);

  const handleStartCreate = () => {
    setMode('create');
    setSelectedRegionId(null);
    setDraftNewFeature(null);
    setNewAreaName('');
    setNewAreaDescription('');
    setStatus(null);
  };

  const handleSelectRegion = (region: Region) => {
    setSelectedRegionId(region.id);
    setMode('view');
    setStatus(null);
    setIsEditingShape(false);
    setShapeDraft(null);
  };

  const handleSaveNewArea = async () => {
    if (!user) return;
    if (!draftNewFeature?.geometry) {
      setStatus('Draw an area on the map before saving.');
      showToast('Draw an area on the map before saving.', 'error');
      return;
    }

    setSavingNewArea(true);
    setStatus('Saving…');

    try {
      const trimmedName = newAreaName.trim();
      const trimmedDescription = newAreaDescription.trim();

      const properties: Record<string, unknown> = { receive_alerts: true };
      if (trimmedDescription) {
        properties.description = trimmedDescription;
      }

      const created = await createRegion({
        user_id: user.id.toString(),
        name: trimmedName || undefined,
        area_geojson: draftNewFeature.geometry,
        properties,
      });

      const refreshed = await fetchRegions(user.id.toString());
      setRegions(refreshed);
      setSelectedRegionId(created.id);
      setMode('view');
      setStatus('Area saved!');
      setDraftNewFeature(null);
      setNewAreaName('');
      setNewAreaDescription('');
      showToast('Area saved successfully.', 'success');
    } catch (error) {
      console.error(error);
      setStatus('Failed to save region.');
      showToast('Failed to save region.', 'error');
    } finally {
      setSavingNewArea(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedRegion) return;

    setSavingDetails(true);

    const trimmedName = editName.trim();
    const trimmedDescription = editDescription.trim();
    const currentProperties = { ...(selectedRegion.properties ?? {}) } as Record<string, unknown>;
    const nextProperties: Record<string, unknown> = {
      ...currentProperties,
      receive_alerts: receiveAlerts,
    };

    if (trimmedDescription) {
      nextProperties.description = trimmedDescription;
    } else {
      delete nextProperties.description;
    }

    try {
      await updateRegion(selectedRegion.id, {
        name: trimmedName || undefined,
        properties: nextProperties,
      });

      setRegions((prev) =>
        prev.map((region) =>
          region.id === selectedRegion.id
            ? {
                ...region,
                name: trimmedName || undefined,
                properties: nextProperties,
              }
            : region,
        ),
      );
      showToast('Area details updated.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Unable to update area.', 'error');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleToggleAlerts = async (next: boolean) => {
    if (!selectedRegion) return;
    setReceiveAlerts(next);
    setUpdatingAlerts(true);

    const currentProperties = { ...(selectedRegion.properties ?? {}) } as Record<string, unknown>;
    const updated = {
      ...currentProperties,
      receive_alerts: next,
    };

    try {
      await updateRegion(selectedRegion.id, { properties: updated });
      setRegions((prev) =>
        prev.map((region) =>
          region.id === selectedRegion.id
            ? {
                ...region,
                properties: updated,
              }
            : region,
        ),
      );
      showToast(next ? 'Alerts enabled for this area.' : 'Alerts disabled for this area.', 'info');
    } catch (error) {
      console.error(error);
      showToast('Unable to update area alerts.', 'error');
      setReceiveAlerts(!next);
    } finally {
      setUpdatingAlerts(false);
    }
  };

  const handleStartShapeEdit = () => {
    if (!previewFeature) return;
    setShapeDraft(previewFeature);
    setIsEditingShape(true);
  };

  const handleCancelShapeEdit = () => {
    setIsEditingShape(false);
    setShapeDraft(null);
  };

  const handleSaveShape = async () => {
    if (!selectedRegion) return;
    if (!shapeDraft?.geometry) {
      showToast('Draw or edit the area before saving changes.', 'error');
      return;
    }

    setSavingShape(true);

    try {
      await updateRegion(selectedRegion.id, {
        area_geojson: shapeDraft.geometry,
      });

      setRegions((prev) =>
        prev.map((region) =>
          region.id === selectedRegion.id
            ? {
                ...region,
                area_geojson: shapeDraft.geometry,
              }
            : region,
        ),
      );

      showToast('Area shape updated.', 'success');
      setIsEditingShape(false);
      setShapeDraft(null);
    } catch (error) {
      console.error(error);
      showToast('Unable to update area shape.', 'error');
    } finally {
      setSavingShape(false);
    }
  };

  const handleApplyCityShape = (city: CityFeature) => {
    setMode('create');
    setSelectedRegionId(null);
    setIsEditingShape(false);
    setShapeDraft(null);
    const cloned = JSON.parse(JSON.stringify(city)) as Feature;
    setDraftNewFeature(cloned);
    setNewAreaName(`${city.properties.name}, ${city.properties.state}`);
    setNewAreaDescription(city.properties.cwa ? `Based on NOAA ${city.properties.cwa}` : '');
    setStatus('City shape loaded — tweak the outline as needed, then save.');
  };

  const handleDeleteRegion = async (region: Region) => {
    try {
      await deleteRegion(region.id);
      setRegions((prev) => prev.filter((item) => item.id !== region.id));
      showToast('Area removed.', 'success');
      if (selectedRegionId === region.id) {
        if (regions.length > 1) {
          const fallback = regions.find((item) => item.id !== region.id);
          setSelectedRegionId(fallback ? fallback.id : null);
          setMode(fallback ? 'view' : 'create');
        } else {
          setSelectedRegionId(null);
          setMode('create');
        }
      }
    } catch (error) {
      console.error(error);
      showToast('Unable to remove area.', 'error');
    } finally {
      setConfirmDeleteRegion(null);
    }
  };

  const handleExportRegions = () => {
    if (!regions.length) {
      return;
    }
    const blob = new Blob([JSON.stringify(regions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `weather-areas-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="page-section">
      <div className="section-header">
        <div>
          <h2>My Coverage Areas</h2>
          <p>Draw the neighborhoods, cities, or routes you care about most.</p>
        </div>
        <div className="section-actions">
          <button type="button" className="action secondary" onClick={handleExportRegions} disabled={!regions.length}>
            Download GeoJSON
          </button>
          <button type="button" className="action" onClick={handleStartCreate}>
            Draw new area
          </button>
        </div>
      </div>

      <div className="area-layout">
        <section className="card area-workspace">
          <header className="workspace-header">
            <div>
              <h3>{mode === 'create' ? 'Create a new area' : selectedRegion?.name ?? 'Saved area'}</h3>
              <p>
                {mode === 'create'
                  ? 'Sketch a custom polygon and save it for future alerts.'
                  : 'Review the details for this area, tweak the shape, or adjust notifications.'}
              </p>
            </div>
            {mode === 'view' && selectedRegion ? (
              <button type="button" className="action secondary" onClick={handleStartCreate}>
                Start another area
              </button>
            ) : null}
          </header>

          {mode === 'create' ? (
            <>
              <MapEditor
                center={[mapCenter.lat, mapCenter.lng]}
                onSave={setDraftNewFeature}
                initialFeature={draftNewFeature}
                height={420}
              />
              <p className="helper">Draw a polygon on the map, then give it a name so you can reuse it.</p>
              <div className="field">
                <label htmlFor="new-area-name">Area name</label>
                <input
                  id="new-area-name"
                  value={newAreaName}
                  onChange={(event) => setNewAreaName(event.target.value)}
                  placeholder="City loop, commute, etc."
                />
              </div>
              <div className="field">
                <label htmlFor="new-area-description">Description (optional)</label>
                <textarea
                  id="new-area-description"
                  value={newAreaDescription}
                  onChange={(event) => setNewAreaDescription(event.target.value)}
                  rows={3}
                />
              </div>
              {status && <p className="status-message">{status}</p>}
              <div className="form-actions">
                <button type="button" className="action secondary" onClick={() => setDraftNewFeature(null)} disabled={!draftNewFeature}>
                  Clear drawing
                </button>
                <button
                  type="button"
                  className="action"
                  onClick={handleSaveNewArea}
                  disabled={savingNewArea || !draftNewFeature}
                >
                  {savingNewArea ? 'Saving…' : 'Save area'}
                </button>
              </div>
            </>
          ) : selectedRegion ? (
            <>
              {isEditingShape ? (
                <>
                  <MapEditor
                    center={[mapCenter.lat, mapCenter.lng]}
                    onSave={setShapeDraft}
                    initialFeature={shapeDraft ?? previewFeature}
                    height={420}
                  />
                  <p className="helper">Adjust the vertices, then save your changes.</p>
                  <div className="form-actions">
                    <button type="button" className="action secondary" onClick={handleCancelShapeEdit} disabled={savingShape}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="action"
                      onClick={handleSaveShape}
                      disabled={savingShape || !shapeDraft}
                    >
                      {savingShape ? 'Saving…' : 'Save shape'}
                    </button>
                  </div>
                </>
              ) : (
                <RegionPreview
                  feature={previewFeature}
                  center={mapCenter}
                  regionId={selectedRegion?.id ?? null}
                />
              )}

              {!isEditingShape ? (
                <div className="area-details">
                  <div className="field-group">
                    <div className="field">
                      <label htmlFor="edit-area-name">Name</label>
                      <input
                        id="edit-area-name"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        placeholder="Give this area a friendly name"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="edit-area-description">Description (optional)</label>
                      <textarea
                        id="edit-area-description"
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={receiveAlerts}
                      onChange={(event) => handleToggleAlerts(event.target.checked)}
                      disabled={updatingAlerts}
                    />
                    <span>{receiveAlerts ? 'Alerts enabled' : 'Alerts muted'}</span>
                  </label>
                  <div className="form-actions">
                    <button type="button" className="action secondary" onClick={handleStartShapeEdit}>
                      Edit shape
                    </button>
                    <button
                      type="button"
                      className="action"
                      onClick={handleSaveDetails}
                      disabled={savingDetails}
                    >
                      {savingDetails ? 'Saving…' : 'Save details'}
                    </button>
                    <button
                      type="button"
                      className="action destructive"
                      onClick={() => setConfirmDeleteRegion(selectedRegion)}
                    >
                      Delete area
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p>Select an area from the list or draw a new one to get started.</p>
          )}
        </section>

        <section className="card saved-areas">
          <header className="section-subheader">
            <h3>Saved areas</h3>
            <span>{regions.length} total</span>
          </header>
          <div className="area-list">
            {regions.map((region) => {
              const properties = (region.properties ?? {}) as Record<string, unknown>;
              const isActive = region.id === selectedRegionId;
              const center = extractRegionCenter(region.area_geojson);
              return (
                <button
                  key={region.id}
                  type="button"
                  className={`area-list-item${isActive ? ' is-active' : ''}`}
                  onClick={() => handleSelectRegion(region)}
                >
                  <div>
                    <strong>{region.name ?? 'Custom area'}</strong>
                    <p>{properties.description ?? 'GeoJSON polygon'}</p>
                  </div>
                  {center ? (
                    <span className="meta">
                      {center.lat.toFixed(2)}, {center.lng.toFixed(2)}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {regions.length === 0 && <p>No areas yet — draw a shape on the map and save it.</p>}
          </div>
        </section>
      </div>

      <section className="card">
        <h3>Suggested Cities</h3>
        <div className="pill-list">
          {cities.map((city) => (
            <button
              key={`${city.properties.name}-${city.properties.state}`}
              type="button"
              className="pill pill-button"
              onClick={() => handleApplyCityShape(city)}
            >
              {city.properties.name}, {city.properties.state}
              {city.properties.cwa ? ` · ${city.properties.cwa}` : ''}
            </button>
          ))}
        </div>
      </section>

      {confirmDeleteRegion && (
        <Modal title="Delete area" onClose={() => setConfirmDeleteRegion(null)}>
          <p>
            Are you sure you want to delete{' '}
            <strong>{confirmDeleteRegion.name ?? 'this area'}</strong>? This action cannot be undone.
          </p>
          <div className="form-actions">
            <button type="button" className="action secondary" onClick={() => setConfirmDeleteRegion(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="action destructive"
              onClick={() => handleDeleteRegion(confirmDeleteRegion)}
            >
              Delete area
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AreasPage;

const regionToFeature = (region: Region | null | undefined): Feature | null => {
  if (!region?.area_geojson) return null;
  const feature = normalizeGeoJson(region.area_geojson);
  return feature;
};

const featureCenter = (feature: Feature | CityFeature | null): LatLngLiteral | null => {
  if (!feature?.geometry) return null;
  return extractRegionCenter(feature);
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

const averageCoords = (points: number[][]): [number, number] => {
  const total = points.reduce<[number, number]>((acc, [lng, lat]) => {
    acc[0] += lng;
    acc[1] += lat;
    return acc;
  }, [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
};

interface RegionPreviewProps {
  feature: Feature | null;
  center: LatLngLiteral;
  regionId: number | null;
}

const RegionPreview = ({ feature, center, regionId }: RegionPreviewProps) => {
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    if (!map || !feature?.geometry) return;
    const layer = L.geoJSON(feature as any);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [map, feature, regionId]);

  return (
    <MapContainer
      key={regionId ?? 'preview'}
      center={center}
      zoom={11}
      style={{ height: '420px', width: '100%' }}
      whenCreated={setMap}
      whenReady={(event) => event.target.invalidateSize()}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {feature?.geometry ? (
        <GeoJSON key={regionId ?? 'preview'} data={feature as any} style={{ color: '#38bdf8', weight: 2, fillOpacity: 0.15 }} />
      ) : null}
    </MapContainer>
  );
};
