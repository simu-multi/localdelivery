import { useState, useEffect, useRef, useCallback } from 'react';
import { searchPlaces, type PlaceResult } from '../lib/maps';
import { PText, PSpinner } from '@porsche-design-system/components-react';

interface Props {
  label: string;
  value: string;
  onPlaceSelected: (place: PlaceResult) => void;
  onInput?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function AddressSearch({
  label,
  value,
  onPlaceSelected,
  onInput,
  placeholder,
  required,
}: Props) {
  const [text, setText] = useState(value);
  const [predictions, setPredictions] = useState<PlaceResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  const fetchPredictions = useCallback((input: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (input.trim().length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      setLoadingPredictions(false);
      return;
    }

    setLoadingPredictions(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(input);
        setPredictions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setPredictions([]);
      } finally {
        setLoadingPredictions(false);
      }
    }, 300);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setText(v);
    onInput?.(v);
    fetchPredictions(v);
  }

  function selectPrediction(place: PlaceResult) {
    setShowDropdown(false);
    setText(place.address);
    onInput?.(place.address);
    onPlaceSelected(place);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('mousedown', onClick);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <PText size="x-small" weight="semi-bold" className="block mb-1">
        {label}
        {required ? ' *' : ''}
      </PText>
      <div className="relative">
        <input
          type="text"
          value={text}
          onChange={handleInput}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder ?? 'Search for an address'}
          className="w-full px-3 py-2.5 pl-9 rounded-lg border-2 border-contrast-low bg-surface text-sm focus:outline-none focus:border-[#006FFF] transition-colors"
        />
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-contrast-medium pointer-events-none">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
              fill="currentColor"
            />
          </svg>
        </span>
        {loadingPredictions && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <PSpinner size="small" aria={{ 'aria-label': 'Searching' }} />
          </span>
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 bg-surface rounded-xl border border-contrast-low max-h-64 overflow-y-auto shadow-xl"
          style={{ boxShadow: '0px 8px 24px rgba(0,0,0,.12)' }}
        >
          {predictions.map((p, idx) => {
            const parts = p.address.split(',');
            const primary = parts[0]?.trim() ?? p.address;
            const secondary = parts.slice(1).join(',').trim();

            return (
              <li key={p.placeId || `${p.lat}-${p.lng}-${idx}`}>
                <button
                  type="button"
                  onClick={() => selectPrediction(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-canvas transition-colors flex items-start gap-2 border-b border-contrast-low last:border-0 cursor-pointer"
                >
                  <span className="text-contrast-medium mt-0.5 shrink-0">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <PText size="small" className="truncate font-medium">
                      {primary}
                    </PText>
                    {secondary && (
                      <PText size="x-small" className="text-contrast-medium truncate">
                        {secondary}
                      </PText>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
