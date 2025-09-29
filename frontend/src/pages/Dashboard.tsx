import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchAlerts } from '../services/api';
import { clearMutedAlerts, loadMutedAlerts, muteAlert } from '../utils/storage';

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

  useEffect(() => {
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
  };

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

export default Dashboard;
