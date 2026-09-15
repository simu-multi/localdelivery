// Google Maps JS API loader and helpers

let mapsPromise: Promise<typeof google> | null = null;

export function getMapsApiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string ?? '';
}

export function isMapsConfigured(): boolean {
  return !!getMapsApiKey();
}

export function loadMaps(): Promise<typeof google> {
  if (mapsPromise) return mapsPromise;
  const key = getMapsApiKey();
  if (!key) {
    return Promise.reject(new Error('Google Maps API key not configured. Set VITE_GOOGLE_MAPS_API_KEY in your environment.'));
  }
  mapsPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.maps) resolve(window.google);
      else reject(new Error('Failed to load Google Maps'));
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

// Haversine distance in km
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Geocode an address string to coordinates
export async function geocodeAddress(address: string): Promise<PlaceResult | null> {
  const g = await loadMaps();
  const geocoder = new g.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        resolve({
          address: results[0].formatted_address,
          lat: loc.lat(),
          lng: loc.lng(),
          placeId: results[0].place_id,
        });
      } else {
        resolve(null);
      }
    });
  });
}

// Get distance in km using the Directions API (road distance)
export async function roadDistanceKm(origin: LatLng, destination: LatLng): Promise<number | null> {
  const g = await loadMaps();
  const service = new g.maps.DirectionsService();
  return new Promise((resolve) => {
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: g.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result && result.routes[0] && result.routes[0].legs[0]) {
          const meters = result.routes[0].legs[0].distance?.value ?? 0;
          resolve(meters / 1000);
        } else {
          resolve(null);
        }
      }
    );
  });
}

declare global {
  interface Window {
    google: typeof google;
  }
}
