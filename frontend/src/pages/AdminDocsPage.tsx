import { useCallback, useEffect, useMemo, useState } from 'react';
import { SERVICE_DOCS, type ServiceDocConfig } from '../data/serviceDocs';

interface ServiceStatusState {
  state: 'loading' | 'healthy' | 'warning' | 'unreachable' | 'unknown';
  detail?: string;
}

const STATUS_LABELS: Record<ServiceStatusState['state'], string> = {
  loading: 'Checking…',
  healthy: 'Healthy',
  warning: 'Attention',
  unreachable: 'Unreachable',
  unknown: 'Unknown',
};

const AdminDocsPage = () => {
  const defaultBase = typeof window !== 'undefined' ? window.location.origin : '';
  const docsBase = (import.meta.env.VITE_SERVICE_DOCS_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? defaultBase) as string;

  const initialStatuses = useMemo(() => {
    const entries = SERVICE_DOCS.map((service) => [
      service.id,
      { state: service.healthPath ? 'loading' : 'unknown' } as ServiceStatusState,
    ]);
    return Object.fromEntries(entries) as Record<string, ServiceStatusState>;
  }, []);

  const [statuses, setStatuses] = useState<Record<string, ServiceStatusState>>(initialStatuses);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [copiedServiceId, setCopiedServiceId] = useState<string | null>(null);
  const displayBase = docsBase || defaultBase || '/';

  const normalizeUrl = useCallback(
    (path: string | undefined) => {
      if (!path) return '';
      if (/^https?:\/\//i.test(path)) {
        return path;
      }
      const trimmedBase = docsBase.replace(/\/$/, '');
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return `${trimmedBase}${normalizedPath}`;
    },
    [docsBase],
  );

  const evaluateHealth = useCallback(
    async (service: ServiceDocConfig): Promise<[string, ServiceStatusState]> => {
      if (!service.healthPath) {
        return [service.id, { state: 'unknown', detail: 'No health endpoint configured' }];
      }

      const url = normalizeUrl(service.healthPath);
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          return [
            service.id,
            {
              state: 'warning',
              detail: `${response.status} ${response.statusText}`,
            },
          ];
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }

        const rawStatus =
          (payload && typeof payload === 'object' && 'status' in payload && (payload as Record<string, unknown>).status) ||
          (payload && typeof payload === 'object' && 'state' in payload && (payload as Record<string, unknown>).state) ||
          response.statusText;

        const normalized = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : '';
        const state: ServiceStatusState['state'] =
          normalized.includes('ok') || normalized.includes('up') ? 'healthy' : 'warning';

        return [
          service.id,
          {
            state,
            detail:
              payload && typeof payload === 'object'
                ? JSON.stringify(payload, null, 2)
                : undefined,
          },
        ];
      } catch (error: any) {
        const detail = error?.message ?? 'Request failed';
        return [service.id, { state: 'unreachable', detail }];
      }
    },
    [normalizeUrl],
  );

  const refreshHealth = useCallback(async () => {
    setRefreshing(true);
    try {
      const results = await Promise.all(SERVICE_DOCS.map((service) => evaluateHealth(service)));
      setStatuses((prev) => {
        const next = { ...prev };
        for (const [id, status] of results) {
          next[id] = status;
        }
        return next;
      });
      setLastChecked(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [evaluateHealth]);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const handleCopy = useCallback((serviceId: string, url: string) => {
    if (!url) return;
    if (!navigator?.clipboard) {
      console.warn('Clipboard API unavailable');
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedServiceId(serviceId);
        setTimeout(() => setCopiedServiceId((current) => (current === serviceId ? null : current)), 2000);
      })
      .catch((error) => {
        console.warn('Unable to copy URL', error);
      });
  }, []);

  const formatTimestamp = useCallback((value: Date | null) => {
    if (!value) return 'Never';
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Service Catalogue</h1>
          <p className="page-subtitle">
            Swagger UI, OpenAPI JSON, and health diagnostics for every Weather Alerts microservice.
          </p>
        </div>
        <div className="section-actions">
          <button type="button" className="action" onClick={refreshHealth} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh health'}
          </button>
        </div>
      </header>

      <section className="page-section">
        <div className="status-summary">
          <span>
            Base URL:
            <code>{displayBase}</code>
          </span>
          <span>
            Last checked: <strong>{formatTimestamp(lastChecked)}</strong>
          </span>
        </div>

        <div className="service-doc-grid">
          {SERVICE_DOCS.map((service) => {
            const docsUrl = normalizeUrl(service.docsPath);
            const openApiUrl = normalizeUrl(service.openApiPath);
            const healthUrl = service.healthPath ? normalizeUrl(service.healthPath) : '';
            const status = statuses[service.id] ?? { state: 'unknown' };

            return (
              <article key={service.id} className="service-doc-card">
                <header className="service-doc-card__header">
                  <div>
                    <h2>{service.name}</h2>
                    <p className="service-doc-card__descr">{service.description}</p>
                  </div>
                  <span className={`status-badge status-${status.state}`}>{STATUS_LABELS[status.state]}</span>
                </header>

                {service.tags?.length ? (
                  <div className="service-doc-tags">
                    {service.tags.map((tag) => (
                      <span key={tag} className="service-tag">
                        {tag}
                      </span>
                    ))}
                    <span className="service-tag service-tag--stack">{service.stack.toUpperCase()}</span>
                  </div>
                ) : (
                  <div className="service-doc-tags">
                    <span className="service-tag service-tag--stack">{service.stack.toUpperCase()}</span>
                  </div>
                )}

                <div className="service-doc-links">
                  <a href={docsUrl} target="_blank" rel="noreferrer" className="service-link">
                    Open Swagger UI
                  </a>
                  <button
                    type="button"
                    className="service-link secondary"
                    onClick={() => handleCopy(service.id, openApiUrl)}
                  >
                    {copiedServiceId === service.id ? 'Copied!' : 'Copy OpenAPI URL'}
                  </button>
                  <a href={openApiUrl} target="_blank" rel="noreferrer" className="service-link tertiary">
                    View JSON
                  </a>
                  {healthUrl ? (
                    <a href={healthUrl} target="_blank" rel="noreferrer" className="service-link tertiary">
                      Health endpoint
                    </a>
                  ) : null}
                </div>

                {status.detail ? (
                  <details className="service-doc-detail">
                    <summary>Latest health payload</summary>
                    <pre>{status.detail}</pre>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AdminDocsPage;
