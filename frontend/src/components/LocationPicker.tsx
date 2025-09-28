import { memo, useCallback, useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
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

const LocationPicker = ({ latitude, longitude, onChange }: LocationPickerProps) => {
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
      <MarkerHandler position={center} onDrag={handleSelect} />
      <MapClickHandler onClick={handleSelect} />
    </MapContainer>
  );
};

export default LocationPicker;
