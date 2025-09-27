import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAdminSummary } from '../services/api';

interface Summary {
  total_users: number;
  total_alerts: number;
  total_notifications: number;
}

const AdminDashboard = () => {
  const { logout } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminSummary()
      .then(setSummary)
      .catch(() => setError('Unable to load summary. Ensure admin token is configured.'));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Admin Overview</h1>
        <button onClick={logout}>Sign out</button>
      </header>

      {error && <p className="error">{error}</p>}

      {summary ? (
        <div className="card-grid">
          <article className="card">
            <h3>Total Users</h3>
            <p>{summary.total_users}</p>
          </article>
          <article className="card">
            <h3>Active Alerts</h3>
            <p>{summary.total_alerts}</p>
          </article>
          <article className="card">
            <h3>Notifications Sent</h3>
            <p>{summary.total_notifications}</p>
          </article>
        </div>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
};

export default AdminDashboard;
