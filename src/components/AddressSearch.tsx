import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMaps, type PlaceResult } from '../lib/maps';
import { PText, PSpinner } from '@porsche-design-system/components-react';

interface Props {
  label: string;
  value: string;
  onPlaceSelected: (place: PlaceResult) => void;
  onInput?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function AddressSearch({ label, value, onPlaceSelected, onInput, placeholder, required }: Props) {
  const [text, setText] = useState(value);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState('');
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    let active = true;
    loadMaps()
      .then((g) => {
        if (!active) return;
        autocompleteRef.current = new g.maps.places.AutocompleteService();
        setMapsReady(true);
      })
      .catch((err) => {
        if (!active) return;
        setMapsError(err.message ?? 'Maps unavailable');
      });
    return () => { active = false; };
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (!autocompleteRef.current || input.trim().length < 3) {
      setPredictions([]);
      return;
    }
    setLoadingPredictions(true);
    autocompleteRef.current.getPlacePredictions(
      { input, componentRestrictions: { country: 'in' } },
      (results, status) => {
        setLoadingPredictions(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
          setShowDropdown(true);
        } else {
          setPredictions([]);
        }
      }
    );
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setText(v);
    onInput?.(v);
    fetchPredictions(v);
  }

  async function selectPrediction(pred: google.maps.places.AutocompletePrediction) {
    setShowDropdown(false);
    setText(pred.description);
    onInput?.(pred.description);

    // Geocode the place to get coordinates
    const g = await loadMaps();
    const geocoder = new g.maps.Geocoder();
    geocoder.geocode({ placeId: pred.place_id }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        onPlaceSelected({
          address: results[0].formatted_address,
          lat: loc.lat(),
          lng: loc.lng(),
          placeId: results[0].place_id,
        });
      }
    });
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (mapsError) {
    return (
      <div>
        <PText size="x-small" weight="semi-bold" className="block mb-1">{label}{required ? ' *' : ''}</PText>
        <input
          type="text"
          value={text}
          onChange={handleInput}
          placeholder={placeholder ?? 'Enter address'}
          className="w-full px-3 py-2.5 rounded-lg border-2 border-contrast-low bg-surface text-sm focus:outline-none focus:border-[#006FFF]"
        />
        <PText size="x-small" className="text-contrast-medium mt-1">
          Map search unavailable ({mapsError}). Enter address manually.
        </PText>
      </div>
    );
  }

  if (!mapsReady) {
    return (
      <div>
        <PText size="x-small" weight="semi-bold" className="block mb-1">{label}{required ? ' *' : ''}</PText>
        <div className="flex items-center gap-2 py-2">
          <PSpinner size="small" aria={{ 'aria-label': 'Loading maps' }} />
          <PText size="x-small" className="text-contrast-medium">Loading map search…</PText>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <PText size="x-small" weight="semi-bold" className="block mb-1">{label}{required ? ' *' : ''}</PText>
      <div className="relative">
        <input
          type="text"
          value={text}
          onChange={handleInput}
          onFocus={() => predictions.length && setShowDropdown(true)}
          placeholder={placeholder ?? 'Search for an address'}
          className="w-full px-3 py-2.5 pl-9 rounded-lg border-2 border-contrast-low bg-surface text-sm focus:outline-none focus:border-[#006FFF] transition-colors"
        />
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-contrast-medium pointer-events-none">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="currentColor"/></svg>
        </span>
        {loadingPredictions && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <PSpinner size="small" aria={{ 'aria-label': 'Searching' }} />
          </span>
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 bg-surface rounded-xl border border-contrast-low max-h-64 overflow-y-auto"
          style={{ boxShadow: '0px 8px 24px rgba(0,0,0,.12)' }}
        >
          {predictions.map((p) => (
            <li key={p.place_id}>
              <button
                type="button"
                onClick={() => selectPrediction(p)}
                className="w-full text-left px-3 py-2.5 hover:bg-canvas transition-colors flex items-start gap-2 border-b border-contrast-low last:border-0"
              >
                <span className="text-contrast-medium mt-0.5 shrink-0">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2"/></svg>
                </span>
                <div className="min-w-0">
                  <PText size="small" className="truncate">{p.structured_formatting.main_text}</PText>
                  <PText size="x-small" className="text-contrast-medium truncate">{p.structured_formatting.secondary_text}</PText>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
