import type { Feature } from 'geojson';
import { useEffect, useMemo, useState } from 'react';
import MapEditor from '../components/MapEditor';
import { useAuth } from '../context/AuthContext';
import { createRegion, fetchAlerts, fetchRegions, listCities } from '../services/api';

interface AlertItem {
  id: number;
  title: string;
  severity?: string;
  event?: string;
  sent: string;
}

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts().then(setAlerts).catch(console.error);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchRegions(user.id.toString()).then(setRegions).catch(console.error);
  }, [user]);

  useEffect(() => {
    listCities().then((data) => setCities(data.features || [])).catch(console.error);
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
    setStatus('Saving region…');
    try {
      await createRegion({
        user_id: user.id.toString(),
        name: 'My Area',
        area_geojson: feature.geometry,
      });
      const updated = await fetchRegions(user.id.toString());
      setRegions(updated);
      setStatus('Region saved!');
    } catch (error) {
      console.error(error);
      setStatus('Failed to save region');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Welcome back{user?.full_name ? `, ${user.full_name}` : ''}</h1>
        <button onClick={logout}>Sign out</button>
      </header>

      <section>
        <h2>Active Alerts</h2>
        <div className="card-grid">
          {alerts.map((alert) => (
            <article key={alert.id} className={`card severity-${alert.severity?.toLowerCase() ?? 'unknown'}`}>
              <h3>{alert.title}</h3>
              <p>{alert.event}</p>
              <span>{new Date(alert.sent).toLocaleString()}</span>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Manage Alert Areas</h2>
        <MapEditor center={mapCenter} onSave={handleSaveRegion} />
        {status && <p>{status}</p>}
        <ul>
          {regions.map((region) => (
            <li key={region.id}>{region.name ?? 'Custom area'} ({region.properties?.description ?? 'GeoJSON'})</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Suggested Cities</h2>
        <div className="pill-list">
          {cities.map((city: any) => (
            <span key={city.properties.name} className="pill">
              {city.properties.name}, {city.properties.state}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
