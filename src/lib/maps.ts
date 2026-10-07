// Leaflet + MapTiler mapping and geolocation helpers

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

export function getMapTilerApiKey(): string {
  return (import.meta.env.VITE_MAPTILER_API_KEY as string | undefined)?.trim() ?? '';
}

export function isMapTilerConfigured(): boolean {
  return !!getMapTilerApiKey();
}

export interface TileLayerConfig {
  url: string;
  attribution: string;
  maxZoom: number;
}

export function getTileLayerConfig(): TileLayerConfig {
  const key = getMapTilerApiKey();
  if (key) {
    return {
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${key}`,
      attribution:
        '&copy; <a href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    };
  }

  // Resilient OpenStreetMap fallback if MapTiler API key is not yet set
  return {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  };
}

// Haversine direct distance in km
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Search places / addresses using MapTiler Geocoding API with Nominatim fallback
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const key = getMapTilerApiKey();

  // 1. Try MapTiler Geocoding API if key configured
  if (key) {
    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(trimmed)}.json?key=${key}&country=in&autocomplete=true&limit=6`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.features) && data.features.length > 0) {
          return data.features.map((feat: any) => ({
            address: feat.place_name || feat.text,
            lat: feat.center ? feat.center[1] : feat.geometry.coordinates[1],
            lng: feat.center ? feat.center[0] : feat.geometry.coordinates[0],
            placeId: feat.id,
          }));
        }
      }
    } catch {
      // Fall through to Nominatim fallback
    }
  }

  // 2. OpenStreetMap Nominatim fallback
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&countrycodes=in&limit=6&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'QuickDrop-LocalDelivery/1.0',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items)) {
        return items.map((item: any) => ({
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          placeId: String(item.place_id ?? item.osm_id ?? ''),
        }));
      }
    }
  } catch {
    // Both failed
  }

  return [];
}

// Geocode a single address string to coordinates
export async function geocodeAddress(address: string): Promise<PlaceResult | null> {
  const results = await searchPlaces(address);
  return results[0] ?? null;
}

export interface StructuredAddress {
  house_flat: string;
  building: string;
  road: string;
  area: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export const emptyAddress: StructuredAddress = {
  house_flat: '', building: '', road: '', area: '',
  landmark: '', city: '', district: '', state: '', pincode: '',
};

export function formatAddress(a: StructuredAddress): string {
  const parts = [
    a.house_flat, a.building, a.road, a.area,
    a.landmark && `Near ${a.landmark}`,
    a.city, a.district, a.state, a.pincode,
  ].filter(Boolean);
  return parts.join(', ');
}

// Reverse geocode coordinates into structured address using Nominatim
export async function reverseGeocode(lat: number, lng: number): Promise<Partial<StructuredAddress>> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'QuickDrop-LocalDelivery/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const a = data.address ?? {};
    return {
      building: a.building || a.office || a.amenity || '',
      road: a.road || a.pedestrian || a.footway || a.path || '',
      area: a.neighbourhood || a.suburb || a.quarter || a.residential || '',
      landmark: a.landmark || '',
      city: a.city || a.town || a.village || a.hamlet || '',
      district: a.county || a.state_district || '',
      state: a.state || '',
      pincode: a.postcode || '',
    };
  } catch {
    return {};
  }
}

// Calculate road distance using OSRM driving service with Haversine fallback
export async function roadDistanceKm(origin: LatLng, destination: LatLng): Promise<number | null> {
  if (
    typeof origin.lat !== 'number' ||
    typeof origin.lng !== 'number' ||
    typeof destination.lat !== 'number' ||
    typeof destination.lng !== 'number'
  ) {
    return null;
  }

  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
    const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes[0]) {
        const meters = data.routes[0].distance;
        return Number((meters / 1000).toFixed(2));
      }
    }
  } catch {
    // Fallback to Haversine with road winding factor
  }

  // Fallback: Haversine distance with an average 1.25x road winding factor
  const straight = haversineKm(origin, destination);
  if (straight >= 0) {
    return Number((straight * 1.25).toFixed(2));
  }

  return null;
}
