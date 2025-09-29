import { useEffect, useState } from 'react';
import apiClient from '../services/api';

interface ForecastPreviewProps {
  latitude: number;
  longitude: number;
}

interface ForecastPeriod {
  start_time: string;
  short_forecast?: string | null;
  temperature?: number | null;
  temperature_unit?: string | null;
}

const ForecastPreview = ({ latitude, longitude }: ForecastPreviewProps) => {
  const [periods, setPeriods] = useState<ForecastPeriod[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    setStatus('loading');
    const controller = new AbortController();
    setStatus('loading');
    apiClient
      .get<{ periods: ForecastPeriod[] }>('custom-alerts/api/v1/conditions/preview', {
        params: { latitude, longitude },
        signal: controller.signal,
      })
      .then((response) => {
        setPeriods(response.data.periods);
        setStatus('idle');
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setStatus('error');
      });
    return () => controller.abort();
  }, [latitude, longitude]);

  return (
    <div className="forecast-preview">
      <header>
        <h4>Next few hours</h4>
      </header>
      {status === 'loading' && <p>Loading forecast…</p>}
      {status === 'error' && <p className="error">Unable to load forecast right now.</p>}
      {status === 'idle' && periods && (
        <ul>
          {periods.map((period) => (
            <li key={period.start_time}>
              <strong>{new Date(period.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
              <span>
                {period.short_forecast ?? 'Forecast unavailable'} ·
                {period.temperature !== null && period.temperature !== undefined
                  ? ` ${period.temperature}°${period.temperature_unit ?? ''}`
                  : ' —'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ForecastPreview;
