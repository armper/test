import { useEffect, useMemo, useState } from 'react';
import type { LatLngLiteral } from 'leaflet';

interface BrowserLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface BrowserLocationResult {
  location: LatLngLiteral | null;
  error: GeolocationPositionError | null;
  isLoading: boolean;
}

const defaultOptions: Required<BrowserLocationOptions> = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 300000,
};

export const useBrowserLocation = (
  enabled = true,
  options: BrowserLocationOptions = {},
): BrowserLocationResult => {
  const [location, setLocation] = useState<LatLngLiteral | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);

  const mergedOptions = useMemo(() => ({
    enableHighAccuracy: options.enableHighAccuracy ?? defaultOptions.enableHighAccuracy,
    timeout: options.timeout ?? defaultOptions.timeout,
    maximumAge: options.maximumAge ?? defaultOptions.maximumAge,
  }), [options.enableHighAccuracy, options.maximumAge, options.timeout]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation is not supported by this browser.',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setError(null);
        setIsLoading(false);
      },
      (positionError) => {
        if (cancelled) return;
        setError(positionError);
        setIsLoading(false);
      },
      mergedOptions,
    );

    return () => {
      cancelled = true;
    };
  }, [enabled, mergedOptions]);

  return { location, error, isLoading };
};

export default useBrowserLocation;
