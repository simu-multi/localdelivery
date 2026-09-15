import { useEffect, useRef, useState } from 'react';
import { loadMaps, type LatLng } from '../lib/maps';
import { PText } from '@porsche-design-system/components-react';

interface Props {
  center: LatLng;
  markers?: Array<{ position: LatLng; label?: string; color?: string }>;
  height?: string;
  zoom?: number;
}

export default function MapView({ center, markers = [], height = '280px', zoom = 13 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadMaps()
      .then((g) => {
        if (!active || !mapRef.current) return;
        const map = new g.maps.Map(mapRef.current, {
          center,
          zoom,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        });
        setMapInstance(map);
      })
      .catch((err) => { if (active) setError(err.message ?? 'Map unavailable'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mapInstance) {
      mapInstance.setCenter(center);
    }
  }, [center.lat, center.lng, mapInstance]);

  useEffect(() => {
    if (!mapInstance) return;
    const g = window.google;
    const bounds = new g.maps.LatLngBounds();
    const allPoints = markers.length ? markers.map(m => m.position) : [center];
    allPoints.forEach((p) => bounds.extend(p));

    // Clear existing markers by re-creating
    const newMarkers: google.maps.Marker[] = [];
    markers.forEach((m) => {
      const marker = new g.maps.Marker({
        position: m.position,
        map: mapInstance,
        label: m.label,
        icon: m.color
          ? { path: g.maps.SymbolPath.CIRCLE, scale: 10, fillColor: m.color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
          : undefined,
      });
      newMarkers.push(marker);
    });
    if (!markers.length) {
      newMarkers.push(new g.maps.Marker({ position: center, map: mapInstance }));
    }

    if (allPoints.length > 1) mapInstance.fitBounds(bounds, 50);
    else mapInstance.setCenter(center);

    return () => {
      newMarkers.forEach((m) => m.setMap(null));
    };
  }, [mapInstance, markers, center]);

  if (error) {
    return (
      <div
        className="rounded-[16px] flex items-center justify-center bg-shading"
        style={{ height }}
      >
        <PText size="small" className="text-contrast-medium p-4 text-center">{error}</PText>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="rounded-[16px] overflow-hidden"
      style={{ height, boxShadow: '0px 3px 8px rgba(0,0,0,.08)' }}
    />
  );
}
