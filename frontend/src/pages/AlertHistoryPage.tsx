import { useEffect, useMemo, useState } from 'react';
import { listAlertHistory, type AlertHistoryItem } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'noaa', label: 'NOAA alerts' },
  { value: 'custom', label: 'Custom conditions' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'watch', label: 'Watch' },
  { value: 'warning', label: 'Warning' },
  { value: 'severe', label: 'Severe' },
  { value: 'info', label: 'Information' },
];

const CHANNEL_OPTIONS = [
  { value: 'all', label: 'All channels' },
  { value: 'push', label: 'Push' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

const PAGE_SIZE = 20;

const buildQueryParam = (value: string) => (value === 'all' ? undefined : value);

const toLocalDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const distanceToNow = (iso: string) => {
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return '';
  const diff = Date.now() - value;
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) {
    if (minutes === 0) return 'Just now';
    return minutes > 0 ? `${minutes} min ago` : `in ${Math.abs(minutes)} min`;
  }
  const hours = Math.round(diff / 3600000);
  if (Math.abs(hours) < 24) {
    const label = `hr${Math.abs(hours) === 1 ? '' : 's'}`;
    return hours > 0 ? `${hours} ${label} ago` : `in ${Math.abs(hours)} ${label}`;
  }
  const days = Math.round(diff / 86400000);
  const label = `day${Math.abs(days) === 1 ? '' : 's'}`;
  return days > 0 ? `${days} ${label} ago` : `in ${Math.abs(days)} ${label}`;
};

const channelList = (item: AlertHistoryItem) =>
  Object.entries(item.channels || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([name]) => name);

const AlertHistoryPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [channel, setChannel] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const resetAndLoad = () => {
    setPage(1);
    setHistory([]);
    setSelectedId(null);
  };

  useEffect(() => {
    resetAndLoad();
  }, [source, severity, channel, debouncedSearch, user?.id]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await listAlertHistory({
          userId: String(user.id),
          page,
          pageSize: PAGE_SIZE,
          source: buildQueryParam(source),
          severity: buildQueryParam(severity),
          channel: buildQueryParam(channel),
          search: debouncedSearch || undefined,
        });
        if (cancelled) return;
        setHistory((prev) => (page === 1 ? response.items : [...prev, ...response.items]));
        setHasNext(response.has_next);
        if (page === 1 && selectedId === null && response.items.length) {
          setSelectedId(response.items[0].id);
        }
      } catch (err) {
        console.error(err);
        const message = 'We could not load your alert history.';
        setError(message);
        showToast(message, 'error');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, user, source, severity, channel]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return history.find((item) => item.id === selectedId) ?? null;
  }, [history, selectedId]);

  const selectedChannels = useMemo(() => (selected ? channelList(selected) : []), [selected]);

  const visibleHistory = history;

  const handleLoadMore = () => {
    if (isLoading || !hasNext) return;
    setPage((prev) => prev + 1);
  };

  if (!user) {
    return (
      <div className="page-section">
        <div className="card">
          <h2>Sign in required</h2>
          <p>You need to be logged in to see your alert history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-section">
      <header className="section-header">
        <div>
          <h2>Alert history</h2>
          <p>Explore every alert and notification delivered to you, with rich context and quick filters.</p>
        </div>
      </header>

      <section className="history-controls card">
        <div className="history-search">
          <label htmlFor="history-search" className="sr-only">
            Search alerts
          </label>
          <input
            id="history-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, summary, or description"
          />
        </div>
        <div className="history-filters">
          <label>
            Source
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              {SOURCE_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
              {SEVERITY_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Channel
            <select value={channel} onChange={(event) => setChannel(event.target.value)}>
              {CHANNEL_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="history-grid">
        <div className="history-timeline card">
          {error && <p className="error">{error}</p>}
          {!error && !visibleHistory.length && !isLoading && (
            <div className="empty-state">
              <h3>No alerts yet</h3>
              <p>
                You have not received any alerts that match your filters. Adjust the filters or check back later.
              </p>
            </div>
          )}
          <div className="timeline-list">
            {visibleHistory.map((item) => {
              const channels = channelList(item);
              const isActive = selectedId === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`timeline-item${isActive ? ' active' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <div className="timeline-meta">
                      <span className="timeline-time">{toLocalDate(item.triggered_at)}</span>
                      <span className={`severity severity-${item.severity ?? 'unknown'}`}>
                        {(item.severity ?? 'unknown').toUpperCase()}
                      </span>
                    </div>
                    <h4>{item.title}</h4>
                    {item.summary && <p>{item.summary}</p>}
                    <div className="timeline-tags">
                      <span className="chip source-chip">{item.source.toUpperCase()}</span>
                      {channels.map((entry) => (
                        <span className="chip" key={entry}>
                          {entry.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {hasNext && (
            <div className="timeline-footer">
              <button type="button" onClick={handleLoadMore} disabled={isLoading}>
                {isLoading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>

        <aside className="history-detail card">
          {selected ? (
            <div className="detail-content">
              <header className="detail-header">
                <div>
                  <span className="pill">{selected.source.toUpperCase()}</span>
                  <h3>{selected.title}</h3>
                </div>
                <span className="detail-time" title={new Date(selected.triggered_at).toString()}>
                  {distanceToNow(selected.triggered_at)}
                </span>
              </header>
              {selected.summary && <p className="detail-summary">{selected.summary}</p>}
              <div className="detail-grid">
                <div>
                  <strong>Triggered</strong>
                  <p>{toLocalDate(selected.triggered_at)}</p>
                </div>
                <div>
                  <strong>Severity</strong>
                  <p className={`severity severity-${selected.severity ?? 'unknown'}`}>
                    {(selected.severity ?? 'unknown').toUpperCase()}
                  </p>
                </div>
                <div>
                  <strong>Channels</strong>
                  <div className="detail-channels">
                    {selectedChannels.map((entry) => (
                      <span className="chip" key={entry}>
                        {entry.toUpperCase()}
                      </span>
                    ))}
                    {!selectedChannels.length && <p className="muted">No channels recorded</p>}
                  </div>
                </div>
                {selected.source_id && (
                  <div>
                    <strong>Reference</strong>
                    <p>{selected.source_id}</p>
                  </div>
                )}
              </div>
              {selected.payload && (
                <div className="detail-payload">
                  <strong>Payload</strong>
                  <pre>{JSON.stringify(selected.payload, null, 2)}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Select an alert</h3>
              <p>Pick an alert from the timeline to see full details.</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};

export default AlertHistoryPage;
