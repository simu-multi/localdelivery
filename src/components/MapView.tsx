import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { getTileLayerConfig, type LatLng } from '../lib/maps';

export interface MapMarker {
  position: LatLng;
  label?: string;
  color?: string;
  title?: string;
}

interface Props {
  center?: LatLng;
  markers?: MapMarker[];
  height?: string;
  zoom?: number;
  focusTarget?: LatLng | null;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bengaluru default

function isValidCoord(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val) && val !== 0;
}

function resolveInitialCenter(center?: LatLng, markers: MapMarker[] = []): [number, number] {
  const firstMarker = markers.find(
    (m) => isValidCoord(m.position?.lat) && isValidCoord(m.position?.lng)
  );
  if (firstMarker) {
    return [firstMarker.position.lat, firstMarker.position.lng];
  }
  if (isValidCoord(center?.lat) && isValidCoord(center?.lng)) {
    return [center.lat, center.lng];
  }
  return DEFAULT_CENTER;
}

export default function MapView({
  center,
  markers = [],
  height = '280px',
  zoom = 13,
  focusTarget,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter = resolveInitialCenter(center, markers);
    const tileConfig = getTileLayerConfig();

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Update center if no markers
  useEffect(() => {
    if (!mapRef.current) return;
    if (markers.length <= 1 && isValidCoord(center?.lat) && isValidCoord(center?.lng)) {
      mapRef.current.setView([center.lat, center.lng], zoom);
    }
  }, [center?.lat, center?.lng, zoom, markers.length]);

  // Update markers, route line, and bounds
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const validMarkers = markers.filter(
      (m) => isValidCoord(m.position?.lat) && isValidCoord(m.position?.lng)
    );

    const effectiveMarkers: MapMarker[] =
      validMarkers.length > 0
        ? validMarkers
        : isValidCoord(center?.lat) && isValidCoord(center?.lng)
        ? [{ position: center }]
        : [];

    const pointsToFit: L.LatLngExpression[] = [];

    effectiveMarkers.forEach((m) => {
      const latLng: [number, number] = [m.position.lat, m.position.lng];
      pointsToFit.push(latLng);

      const color = m.color ?? '#006FFF';
      const label = m.label ?? '📍';

      const customIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            background: ${color};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-weight: 700;
            font-size: 12px;
            box-shadow: 0 3px 8px rgba(0,0,0,.35);
            border: 2px solid #ffffff;
          ">${label}</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const leafletMarker = L.marker(latLng, { icon: customIcon }).addTo(layerGroup);
      if (m.title) {
        leafletMarker.bindTooltip(m.title, { direction: 'top', offset: [0, -14] });
      }
    });

    // Draw route line connecting pickup & dropoff if multiple markers
    if (pointsToFit.length >= 2) {
      L.polyline(pointsToFit, {
        color: '#006FFF',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '6, 8',
      }).addTo(layerGroup);

      const bounds = L.latLngBounds(pointsToFit);
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (pointsToFit.length === 1) {
      mapRef.current.setView(pointsToFit[0], zoom);
    }
  }, [markers, center, zoom]);

  // Smooth flyTo when focusTarget changes
  useEffect(() => {
    if (!mapRef.current || !focusTarget) return;
    if (isValidCoord(focusTarget.lat) && isValidCoord(focusTarget.lng)) {
      mapRef.current.flyTo([focusTarget.lat, focusTarget.lng], 16, {
        duration: 1.2,
      });
    }
  }, [focusTarget]);

  return (
    <div
      ref={containerRef}
      className="rounded-[16px] overflow-hidden relative z-0"
      style={{ height, boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}
    />
  );
}
