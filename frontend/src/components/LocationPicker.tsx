import { memo, useCallback, useEffect, useState } from 'react';
import { GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngLiteral } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl,
  shadowUrl: iconShadowUrl,
});

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (coords: LatLngLiteral) => void;
  highlight?: any;
}

const MapClickHandler = ({ onClick }: { onClick: (coords: LatLngLiteral) => void }) => {
  useMapEvents({
    click: (event) => onClick(event.latlng),
  });
  return null;
};

const MarkerHandler = memo(({ position, onDrag }: { position: LatLngLiteral; onDrag: (coords: LatLngLiteral) => void }) => (
  <Marker
    position={position}
    draggable
    eventHandlers={{
      dragend: (event) => {
        const marker = event.target as L.Marker;
        onDrag(marker.getLatLng());
      },
    }}
 />
));

MarkerHandler.displayName = 'MarkerHandler';

const HighlightLayer = ({ highlight }: { highlight: any }) => {
  const map = useMap();

  useEffect(() => {
    if (!highlight) return;
    const layer = L.geoJSON(highlight as any);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      const samePoint = bounds.getNorthEast().equals(bounds.getSouthWest());
      if (samePoint) {
        const center = bounds.getCenter();
        map.setView(center, Math.max(map.getZoom(), 11));
      } else {
        map.fitBounds(bounds.pad(0.1));
      }
    }
    layer.remove();
  }, [highlight, map]);

  if (!highlight) {
    return null;
  }

  return (
    <GeoJSON
      data={highlight as any}
      style={{ color: '#38bdf8', weight: 2, fillOpacity: 0.12 }}
    />
  );
};

const LocationPicker = ({ latitude, longitude, onChange, highlight }: LocationPickerProps) => {
  const [center, setCenter] = useState<LatLngLiteral>({ lat: latitude, lng: longitude });

  useEffect(() => {
    setCenter({ lat: latitude, lng: longitude });
  }, [latitude, longitude]);

  const handleSelect = useCallback(
    (coords: LatLngLiteral) => {
      setCenter(coords);
      onChange(coords);
    },
    [onChange],
  );

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: '320px', width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {highlight ? <HighlightLayer highlight={highlight} /> : null}
      <MarkerHandler position={center} onDrag={handleSelect} />
      <MapClickHandler onClick={handleSelect} />
    </MapContainer>
  );
};

export default LocationPicker;
