import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAlerts } from '../services/api';

interface AlertItem {
  id: number;
  title: string;
  severity?: string;
  event?: string;
  sent: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    fetchAlerts().then(setAlerts).catch(console.error);
  }, []);

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
        {alerts.length > 0 ? (
          <div className="card-grid">
            {alerts.map((alert) => (
              <article key={alert.id} className={`card-item severity-${alert.severity?.toLowerCase() ?? 'unknown'}`}>
                <h4>{alert.title}</h4>
                <p>{alert.event}</p>
                <span>{new Date(alert.sent).toLocaleString()}</span>
              </article>
            ))}
          </div>
        ) : (
          <p>No active alerts in your saved regions right now.</p>
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
