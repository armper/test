import type { Feature } from 'geojson';
import { useEffect, useMemo, useState } from 'react';
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
  type Region,
} from '../services/api';

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006];

const AreasPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDeleteRegion, setConfirmDeleteRegion] = useState<Region | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchRegions(user.id.toString()).then(setRegions).catch(() => setStatus('Unable to load regions.'));
  }, [user]);

  useEffect(() => {
    listCities().then((data) => setCities(data.features || [])).catch(() => null);
  }, []);

  const mapCenter = useMemo(() => {
    const location = user?.default_location as { lat?: number; lng?: number } | undefined;
    if (location?.lat && location?.lng) {
      return [location.lat, location.lng] as [number, number];
    }
    if (cities.length > 0) {
      const first = cities[0].geometry.coordinates;
      return [first[1], first[0]] as [number, number];
    }
    return DEFAULT_CENTER;
  }, [user, cities]);

  const handleSaveRegion = async (feature: Feature) => {
    if (!user) return;
    setStatus('Saving…');
    try {
      const created = await createRegion({
        user_id: user.id.toString(),
        name: 'My Area',
        area_geojson: feature.geometry,
        properties: { receive_alerts: true },
      });
      const updated = await fetchRegions(user.id.toString());
      setRegions(updated);
      setStatus('Region saved!');
      showToast('Area saved successfully.', 'success');
      const match = updated.find((region) => region.id === created.id);
      if (match) {
        setEditingRegion(match);
        const props = (match.properties ?? {}) as Record<string, unknown>;
        setEditName(match.name ?? '');
        setEditDescription((props.description as string) ?? '');
      }
    } catch (error) {
      console.error(error);
      setStatus('Failed to save region.');
      showToast('Failed to save region.', 'error');
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

  return (
    <div className="page-section">
      <div className="section-header">
        <div>
          <h2>My Coverage Areas</h2>
          <p>Draw the neighborhoods, cities, or travel paths you care about most.</p>
        </div>
        <button type="button" className="action secondary" onClick={handleExportRegions} disabled={!regions.length}>
          Download GeoJSON
        </button>
      </div>

      <div className="card">
        <MapEditor center={mapCenter} onSave={handleSaveRegion} />
        <p className="helper">Draw an area on the map, then click save to capture it.</p>
        {status && <p className="status-message">{status}</p>}
      </div>

      <section className="card">
        <h3>Saved Areas</h3>
        <ul className="simple-list">
          {regions.map((region) => {
            const properties = (region.properties ?? {}) as Record<string, unknown>;
            const receiveAlerts = properties.receive_alerts !== false;
            return (
              <li key={region.id}>
                <strong>{region.name ?? 'Custom area'}</strong>
                <span>{properties.description ?? 'GeoJSON polygon'}</span>
               <div className="item-actions">
                 <label className="toggle">
                   <input
                     type="checkbox"
                      checked={receiveAlerts}
                      onChange={async (event) => {
                        const next = event.target.checked;
                        try {
                          await updateRegion(region.id, {
                            properties: {
                              ...properties,
                              receive_alerts: next,
                            },
                          });
                          setRegions((prev) =>
                            prev.map((item) =>
                              item.id === region.id
                                ? { ...item, properties: { ...properties, receive_alerts: next } }
                                : item
                            )
                          );
                          showToast(next ? 'Alerts enabled for this area.' : 'Alerts disabled for this area.', 'info');
                        } catch (err) {
                          console.error(err);
                          showToast('Unable to update area alerts.', 'error');
                        }
                      }}
                    />
                    <span>{receiveAlerts ? 'Receiving alerts' : 'Muted'}</span>
                 </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRegion(region);
                      setEditName(region.name ?? '');
                      setEditDescription((properties.description as string) ?? '');
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="destructive"
                    onClick={async () => {
                      setConfirmDeleteRegion(region);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
          {regions.length === 0 && <li>No areas yet — draw a shape on the map and save it.</li>}
        </ul>
      </section>

      <section className="card">
        <h3>Suggested Cities</h3>
        <div className="pill-list">
          {cities.map((city: any) => (
            <span key={city.properties.name} className="pill">
              {city.properties.name}, {city.properties.state}
            </span>
          ))}
        </div>
      </section>

      {editingRegion && (
        <Modal
          title={`Edit ${editingRegion.name ?? 'area'}`}
          onClose={() => setEditingRegion(null)}
        >
          <form
            className="condition-form"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await updateRegion(editingRegion.id, {
                  name: editName,
                  properties: {
                    ...(editingRegion.properties ?? {}),
                    description: editDescription,
                  },
                });
                const refreshed = await fetchRegions(user!.id.toString());
                setRegions(refreshed);
                showToast('Area updated.', 'success');
                setEditingRegion(null);
              } catch (err) {
                console.error(err);
                showToast('Unable to update area.', 'error');
              }
            }}
          >
            <div className="field">
              <label htmlFor="area-name">Name</label>
              <input
                id="area-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="My favorite neighborhood"
              />
            </div>
            <div className="field">
              <label htmlFor="area-description">Description (optional)</label>
              <textarea
                id="area-description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="action secondary" onClick={() => setEditingRegion(null)}>
                Cancel
              </button>
              <button type="submit" className="action">
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      )}

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
              onClick={async () => {
                try {
                  await deleteRegion(confirmDeleteRegion.id);
                  setRegions((prev) => prev.filter((item) => item.id !== confirmDeleteRegion.id));
                  showToast('Area removed.', 'success');
                } catch (err) {
                  console.error(err);
                  showToast('Unable to remove area.', 'error');
                } finally {
                  setConfirmDeleteRegion(null);
                }
              }}
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
