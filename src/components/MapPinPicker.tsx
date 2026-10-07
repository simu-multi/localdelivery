import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import {
  PModal, PHeading, PButton, PText, PSpinner, PInputSearch,
} from '@porsche-design-system/components-react';
import { getTileLayerConfig, searchPlaces, reverseGeocode, type LatLng, type StructuredAddress } from '../lib/maps';

interface Props {
  open: boolean;
  onDismiss: () => void;
  onConfirm: (coords: LatLng, partial: Partial<StructuredAddress>) => void;
  initialCoords?: LatLng | null;
  protectedFields?: Partial<Record<keyof StructuredAddress, boolean>>;
  label?: string;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

export default function MapPinPicker({
  open, onDismiss, onConfirm, initialCoords, protectedFields = {}, label = 'Select Location',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(initialCoords ?? null);
  const [searchVal, setSearchVal] = useState('');
  const [predictions, setPredictions] = useState<{ address: string; lat: number; lng: number }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [reverseResult, setReverseResult] = useState<Partial<StructuredAddress> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCoords(initialCoords ?? null);
    setReverseResult(null);
    setSearchVal('');
  }, [open, initialCoords]);

  // Init map when modal opens
  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;

    const start: [number, number] = initialCoords
      ? [initialCoords.lat, initialCoords.lng]
      : DEFAULT_CENTER;

    const tileConfig = getTileLayerConfig();
    const map = L.map(containerRef.current, {
      center: start,
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false,
    });
    L.tileLayer(tileConfig.url, { attribution: tileConfig.attribution, maxZoom: tileConfig.maxZoom }).addTo(map);

    const dragIcon = L.divIcon({
      className: '',
      html: `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:#006FFF;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 28],
    });

    const marker = L.marker(start, { icon: dragIcon, draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      const c = { lat: ll.lat, lng: ll.lng };
      setCoords(c);
      doReverseGeocode(c);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const c = { lat: e.latlng.lat, lng: e.latlng.lng };
      marker.setLatLng(c);
      setCoords(c);
      doReverseGeocode(c);
    });

    mapRef.current = map;
    markerRef.current = marker;

    const timer = setTimeout(() => map.invalidateSize(), 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open]);

  const doReverseGeocode = useCallback(async (c: LatLng) => {
    setReverseLoading(true);
    const partial = await reverseGeocode(c.lat, c.lng);
    setReverseLoading(false);
    // Never overwrite protected (manually-entered) fields
    const filtered: Partial<StructuredAddress> = { ...partial };
    if (protectedFields.house_flat && partial.house_flat) delete filtered.house_flat;
    if (protectedFields.landmark && partial.landmark) delete filtered.landmark;
    setReverseResult(filtered);
  }, [protectedFields]);

  // Initial reverse geocode if we have coords
  useEffect(() => {
    if (open && initialCoords && !reverseResult) {
      doReverseGeocode(initialCoords);
    }
  }, [open, initialCoords, doReverseGeocode, reverseResult]);

  function handleSearchInput(v: string) {
    setSearchVal(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 3) { setPredictions([]); setShowDropdown(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(v);
        setPredictions(results);
        setShowDropdown(results.length > 0);
      } catch { setPredictions([]); }
      finally { setSearching(false); }
    }, 300);
  }

  function selectSearchResult(place: { address: string; lat: number; lng: number }) {
    setShowDropdown(false);
    setSearchVal(place.address);
    const c = { lat: place.lat, lng: place.lng };
    setCoords(c);
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng(c);
      mapRef.current.flyTo([c.lat, c.lng], 16, { duration: 0.8 });
    }
    doReverseGeocode(c);
  }

  function handleConfirm() {
    if (!coords) return;
    onConfirm(coords, reverseResult ?? {});
  }

  return (
    <PModal open={open} onDismiss={onDismiss}>
      <PHeading slot="header" size="medium">{label}</PHeading>
      <div className="space-y-3">
        <div className="relative">
          <PInputSearch
            name="map-search"
            value={searchVal}
            onInput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
            placeholder="Search for a place or address"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <PSpinner size="small" />
            </span>
          )}
          {showDropdown && predictions.length > 0 && (
            <ul className="absolute z-[9999] left-0 right-0 mt-1 bg-surface rounded-[12px] border border-contrast-low max-h-48 overflow-y-auto" style={{ boxShadow: '0px 8px 24px rgba(0,0,0,.12)' }}>
              {predictions.map((p, i) => (
                <li key={i}>
                  <button type="button" onClick={() => selectSearchResult(p)}
                    className="w-full text-left px-3 py-2 hover:bg-canvas transition-colors border-b border-contrast-low last:border-0">
                    <PText size="small" className="truncate">{p.address}</PText>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div ref={containerRef} className="rounded-[12px] overflow-hidden" style={{ height: '300px' }} />

        {reverseLoading && (
          <PText size="x-small" className="text-contrast-medium">Looking up address details…</PText>
        )}
        {reverseResult && !reverseLoading && (
          <div className="bg-surface rounded-[12px] p-3" style={{ border: '1px solid var(--pds-color-contrast-low-light, #D8D8DB)' }}>
            <PText size="x-small" weight="semi-bold" className="mb-1">Detected from map</PText>
            {reverseResult.road && <PText size="x-small">Road: {reverseResult.road}</PText>}
            {reverseResult.area && <PText size="x-small">Area: {reverseResult.area}</PText>}
            {reverseResult.city && <PText size="x-small">City: {reverseResult.city}</PText>}
            {reverseResult.district && <PText size="x-small">District: {reverseResult.district}</PText>}
            {reverseResult.state && <PText size="x-small">State: {reverseResult.state}</PText>}
            {reverseResult.pincode && <PText size="x-small">PIN: {reverseResult.pincode}</PText>}
            {coords && <PText size="x-small" className="text-contrast-medium mt-1">GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</PText>}
          </div>
        )}
        {!reverseResult && !reverseLoading && coords && (
          <PText size="x-small" className="text-contrast-medium">GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</PText>
        )}
      </div>
      <div slot="footer" className="flex gap-3">
        <PButton onClick={handleConfirm} disabled={!coords}>Confirm Location</PButton>
        <PButton variant="secondary" onClick={onDismiss}>Cancel</PButton>
      </div>
    </PModal>
  );
}
