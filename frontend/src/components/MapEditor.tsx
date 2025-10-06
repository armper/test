import type { Feature } from 'geojson';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FeatureGroup, MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { FeatureGroup as LeafletFeatureGroup, LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

import '../utils/leafletDefaultIcon';
import { patchLeafletDraw } from '../utils/patchLeafletDraw';

interface MapEditorProps {
  center: LatLngExpression;
  onSave: (geojson: Feature) => void;
  initialFeature?: Feature | null;
  showControls?: boolean;
  height?: number;
}

patchLeafletDraw();

const MapEditor = ({ center, onSave, initialFeature = null, showControls = true, height = 400 }: MapEditorProps) => {
  const [featureGroup, setFeatureGroup] = useState<LeafletFeatureGroup | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const previousCenterKey = useRef<string | null>(null);

  const handleFeatureGroupRef = useCallback((group: LeafletFeatureGroup | null) => {
    setFeatureGroup(group);
  }, []);

  useEffect(() => {
    if (!featureGroup || !initialFeature) {
      return;
    }

    featureGroup.clearLayers();
    const geoJsonLayer = L.geoJSON(initialFeature as any);
    geoJsonLayer.eachLayer((layer) => {
      featureGroup.addLayer(layer);
    });

    if (mapInstance) {
      const bounds = geoJsonLayer.getBounds?.();
      if (bounds && bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [24, 24] });
      }
    }
  }, [featureGroup, initialFeature, mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;

    const key = Array.isArray(center)
      ? center.join(',')
      : typeof center === 'object'
        ? `${(center as any).lat},${(center as any).lng}`
        : String(center);

    if (previousCenterKey.current === key) {
      return;
    }

    mapInstance.setView(center as L.LatLngExpression);
    mapInstance.invalidateSize();
    previousCenterKey.current = key;
  }, [center, mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance;
    const wasEnabled = map.doubleClickZoom?.enabled?.();
    if (wasEnabled) {
      map.doubleClickZoom.disable();
    }
    return () => {
      if (wasEnabled && map.doubleClickZoom) {
        map.doubleClickZoom.enable();
      }
    };
  }, [mapInstance]);

  return (
    <MapContainer
      center={center}
      zoom={10}
      style={{ height: `${height}px`, width: '100%' }}
      whenCreated={setMapInstance}
      whenReady={(event) => event.target.invalidateSize()}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FeatureGroup ref={handleFeatureGroupRef as any} />
      {featureGroup && showControls ? <DrawControls featureGroup={featureGroup} onSave={onSave} /> : null}
    </MapContainer>
  );
};

interface DrawControlsProps {
  featureGroup: LeafletFeatureGroup;
  onSave: (geojson: Feature) => void;
}

const DrawControls = ({ featureGroup, onSave }: DrawControlsProps) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !featureGroup) return undefined;

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup,
        poly: {
          allowIntersection: false,
        },
      },
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          drawError: {
            color: '#f87171',
            message: 'Polygon edges cannot cross.',
            timeout: 1500,
          },
          shapeOptions: {
            weight: 2,
            color: '#38bdf8',
            fillOpacity: 0.15,
          },
        },
        rectangle: true,
        polyline: false,
        marker: false,
        circle: false,
        circlemarker: false,
      },
    });

    map.addControl(drawControl);
    map.invalidateSize();

    const handleCreated = (event: L.DrawEvents.Created) => {
      const layer = event.layer as L.Layer & { toGeoJSON: () => Feature };
      featureGroup.clearLayers();
      featureGroup.addLayer(layer);
      onSave(layer.toGeoJSON());
    };

    const handleEdited = () => {
      const layers = featureGroup.getLayers();
      if (layers.length) {
        const layer = layers[0] as L.Layer & { toGeoJSON: () => Feature };
        onSave(layer.toGeoJSON());
      }
    };

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.removeControl(drawControl);
    };
  }, [map, featureGroup, onSave]);

  return null;
};

export default MapEditor;
