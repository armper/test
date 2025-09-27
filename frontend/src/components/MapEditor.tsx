import type { Feature } from 'geojson';
import { useEffect, useRef } from 'react';
import { FeatureGroup, MapContainer, TileLayer } from 'react-leaflet';
import type { FeatureGroup as LeafletFeatureGroup, LatLngExpression } from 'leaflet';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

L.Icon.Default.mergeOptions({
  iconUrl,
  shadowUrl: iconShadowUrl,
});

interface MapEditorProps {
  center: LatLngExpression;
  onSave: (geojson: Feature) => void;
}

const MapEditor = ({ center, onSave }: MapEditorProps) => {
  const drawnItemsRef = useRef<LeafletFeatureGroup | null>(null);

  useEffect(() => {
    const featureGroup = drawnItemsRef.current;
    if (!featureGroup) return;

    const map = featureGroup._map;
    if (!map) return;

    const drawControl = new L.Control.Draw({
      edit: { featureGroup },
      draw: {
        marker: false,
        circle: false,
        circlemarker: false,
        polyline: false,
      },
    });

    map.addControl(drawControl);

    function handleCreated(event: L.DrawEvents.Created) {
      const layer = event.layer as L.Layer;
      featureGroup.clearLayers();
      featureGroup.addLayer(layer);
      onSave(layer.toGeoJSON() as Feature);
    }

    function handleEdited() {
      const layers = featureGroup.getLayers();
      if (layers.length) {
        const layer = layers[0] as L.Layer & { toGeoJSON: () => Feature };
        onSave(layer.toGeoJSON());
      }
    }

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);

    return () => {
      map.removeControl(drawControl);
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
    };
  }, [onSave]);

  return (
    <MapContainer center={center} zoom={10} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FeatureGroup ref={drawnItemsRef as any} />
    </MapContainer>
  );
};

export default MapEditor;
