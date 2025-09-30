import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  ConditionSubscription,
  deleteConditionSubscription,
  fetchAlerts,
  listConditionSubscriptions,
  fetchRegions,
  type Region,
} from '../services/api';
import Modal from '../components/Modal';
import CustomAlertForm from '../components/ConditionAlertsPanel';

interface AlertItem {
  id: number;
  title: string;
  severity?: string;
  event?: string;
  sent: string;
}

const CustomAlertsPage = () => {
  const { user } = useAuth();
  const { showToast, dismissToast } = useToast();
  const [noaaAlerts, setNoaaAlerts] = useState<AlertItem[]>([]);
  const [customAlerts, setCustomAlerts] = useState<ConditionSubscription[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<ConditionSubscription | undefined>(undefined);
  const recentActivity = useMemo(() => {
    return customAlerts
      .filter((alert) => alert.last_triggered_at)
      .sort((a, b) => (new Date(b.last_triggered_at ?? 0).getTime() - new Date(a.last_triggered_at ?? 0).getTime()))
      .slice(0, 5);
  }, [customAlerts]);
  const initialLocation = useMemo(() => {
    const fallback = { lat: 40.7128, lng: -74.006 };
    const defaults = user?.default_location as { lat?: number; lng?: number } | undefined;
    return {
      lat: defaults?.lat ?? fallback.lat,
      lng: defaults?.lng ?? fallback.lng,
    };
  }, [user]);

  useEffect(() => {
    fetchAlerts().then(setNoaaAlerts).catch(() => null);
  }, []);

  useEffect(() => {
    if (!user) {
      setCustomAlerts([]);
      setRegions([]);
      return;
    }
    setLoading(true);
    Promise.all([
      listConditionSubscriptions(user.id.toString()),
      fetchRegions(user.id.toString()),
    ])
      .then(([alerts, savedRegions]) => {
        setCustomAlerts(alerts);
        setRegions(savedRegions);
      })
      .catch(() => setError('Unable to load custom alerts right now.'))
      .finally(() => setLoading(false));
  }, [user]);

  const refreshCustomAlerts = async (message?: string) => {
    if (!user) return;
    const alerts = await listConditionSubscriptions(user.id.toString());
    setCustomAlerts(alerts);
    setModalOpen(false);
    setEditingAlert(undefined);
    if (message) {
      showToast(message, 'success');
    }
  };

  const handleDelete = (id: number) => {
    if (!user) return;

    let toastId = 0;
    const actions = [
      {
        label: 'Cancel',
        onClick: () => dismissToast(toastId),
      },
      {
        label: 'Delete',
        onClick: async () => {
          try {
            await deleteConditionSubscription(id);
            await refreshCustomAlerts('Custom alert removed.');
          } catch (err) {
            console.error(err);
            setError('Unable to remove that alert right now.');
            showToast('Unable to remove that alert right now.', 'error');
          } finally {
            dismissToast(toastId);
          }
        },
      },
    ];

    toastId = showToast('Remove this custom alert?', 'info', { persistent: true, actions });
  };

  const openCreateModal = () => {
    setEditingAlert(undefined);
    setModalOpen(true);
  };

  const openEditModal = (alert: ConditionSubscription) => {
    setEditingAlert(alert);
    setModalOpen(true);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="page-section">
      <div className="section-header">
        <div>
          <h2>Alerts</h2>
          <p>Review the alerts we monitor for you and the custom reminders you’ve created.</p>
        </div>
        <button type="button" className="action" onClick={openCreateModal}>
          New custom alert
        </button>
      </div>

      <section className="card">
        <header className="section-subheader">
          <h3>Active NOAA Alerts</h3>
          <span>{noaaAlerts.length} currently active</span>
        </header>
        {noaaAlerts.length > 0 ? (
          <div className="card-grid">
            {noaaAlerts.map((alert) => (
              <article key={alert.id} className={`card-item severity-${alert.severity?.toLowerCase() ?? 'unknown'}`}>
                <h4>{alert.title}</h4>
                <p>{alert.event}</p>
                <span>{new Date(alert.sent).toLocaleString()}</span>
              </article>
            ))}
          </div>
        ) : (
          <p>No active NOAA alerts in your regions.</p>
        )}
      </section>

      <section className="card">
        <header className="section-subheader">
          <h3>Custom condition alerts</h3>
          <span>{customAlerts.length} configured</span>
        </header>
        {loading && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        <ul className="condition-list">
          {customAlerts.map((alert) => {
            const metadata = (alert as any).metadata_json ?? (alert as any).metadata ?? {};
            const cooldownMinutes = metadata.cooldown_minutes ?? 60;
            const cooldownHours = Math.max(1, Math.round(cooldownMinutes / 60));
            return (
            <li key={alert.id} className="condition-item">
              <div>
                <h3>{alert.label}</h3>
                <p>
                  Watching {alert.latitude.toFixed(3)}, {alert.longitude.toFixed(3)} — we’ll alert when{' '}
                  <strong>{alert.condition_type.replace('_', ' ')}</strong> crosses {alert.threshold_value}{' '}
                  {alert.threshold_unit ?? ''}.
                </p>
                <p className="meta">
                  Cooldown: {cooldownHours} hour{cooldownHours === 1 ? '' : 's'} between alerts
                </p>
                <p className="meta">
                  Comparison: {alert.comparison} · Last triggered{' '}
                  {alert.last_triggered_at ? new Date(alert.last_triggered_at).toLocaleString() : 'never'}
                </p>
              </div>
              <div className="item-actions">
                <button type="button" onClick={() => openEditModal(alert)}>
                  Edit
                </button>
                <button type="button" className="destructive" onClick={() => handleDelete(alert.id)}>
                  Delete
                </button>
              </div>
            </li>
            );
          })}
          {!loading && customAlerts.length === 0 && <li>No custom alerts yet — create your first one above.</li>}
        </ul>
      </section>

      {modalOpen && (
        <Modal
          title={editingAlert ? 'Edit custom alert' : 'Create custom alert'}
          onClose={() => {
            setModalOpen(false);
            setEditingAlert(undefined);
          }}
        >
          <CustomAlertForm
            userId={user.id.toString()}
            initialLocation={initialLocation}
            regions={regions}
            alert={editingAlert}
            onSaved={() => refreshCustomAlerts(editingAlert ? 'Custom alert updated.' : 'Custom alert saved.')}
            onRegionCreated={(region) => {
              setRegions((prev) => {
                if (prev.some((item) => item.id === region.id)) {
                  return prev;
                }
                return [...prev, region];
              });
            }}
            onCancel={() => {
              setModalOpen(false);
              setEditingAlert(undefined);
            }}
            saveLabel={editingAlert ? 'Update alert' : 'Save alert'}
          />
        </Modal>
      )}
    </div>
  );
};

export default CustomAlertsPage;
