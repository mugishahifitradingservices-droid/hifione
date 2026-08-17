// Rwanda Geographic Utilities and Geocoding Resolver for HIFI ONE

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface ResolvedOrgLocation extends GeoCoordinate {
  districtName: string;
  areaLabel: string;
  isApproximate: boolean;
}

// Default Center of Kigali, Rwanda
export const KIGALI_DEFAULT_CENTER: GeoCoordinate = {
  lat: -1.9441,
  lng: 30.0619
};

// Known business hubs and districts in Kigali and across Rwanda
const RWANDA_LOCATION_HUBS: Record<string, GeoCoordinate> = {
  // Nyarugenge District
  'nyarugenge': { lat: -1.9536, lng: 30.0605 },
  'kigali cbd': { lat: -1.9490, lng: 30.0580 },
  'city center': { lat: -1.9490, lng: 30.0580 },
  'nyabugogo': { lat: -1.9380, lng: 30.0450 },
  'muhima': { lat: -1.9450, lng: 30.0550 },
  'nyamirambo': { lat: -1.9750, lng: 30.0480 },
  'kigali sector': { lat: -1.9600, lng: 30.0350 },
  'gitega': { lat: -1.9520, lng: 30.0510 },

  // Gasabo District
  'gasabo': { lat: -1.9350, lng: 30.0900 },
  'kimihurura': { lat: -1.9540, lng: 30.0920 },
  'kacyiru': { lat: -1.9390, lng: 30.0830 },
  'remera': { lat: -1.9580, lng: 30.1180 },
  'kisimenti': { lat: -1.9560, lng: 30.1120 },
  'gisozi': { lat: -1.9280, lng: 30.0650 },
  'kagugu': { lat: -1.9120, lng: 30.0780 },
  'kibagabaga': { lat: -1.9320, lng: 30.1150 },
  'nyarutarama': { lat: -1.9380, lng: 30.1020 },
  'kimironko': { lat: -1.9480, lng: 30.1260 },
  'kanombe': { lat: -1.9750, lng: 30.1450 },
  'kigali heights': { lat: -1.9545, lng: 30.0940 },
  'rdb': { lat: -1.9395, lng: 30.0820 },
  'convention center': { lat: -1.9535, lng: 30.0935 },

  // Kicukiro District
  'kicukiro': { lat: -1.9700, lng: 30.1000 },
  'gikondo': { lat: -1.9750, lng: 30.0820 },
  'magerwa': { lat: -1.9780, lng: 30.0850 },
  'industrial area': { lat: -1.9760, lng: 30.0830 },
  'niboye': { lat: -1.9720, lng: 30.1030 },
  'sonatubes': { lat: -1.9680, lng: 30.0960 },
  'kagarama': { lat: -1.9820, lng: 30.1150 },
  'gatenga': { lat: -1.9850, lng: 30.0900 },
  'masaka': { lat: -2.0150, lng: 30.2050 },

  // Provinces & Other Districts
  'musanze': { lat: -1.4998, lng: 29.6349 },
  'ruhengeri': { lat: -1.4998, lng: 29.6349 },
  'rubavu': { lat: -1.6766, lng: 29.2562 },
  'gisenyi': { lat: -1.6766, lng: 29.2562 },
  'huye': { lat: -2.5967, lng: 29.7394 },
  'butare': { lat: -2.5967, lng: 29.7394 },
  'bugesera': { lat: -2.1467, lng: 30.0931 },
  'nyamata': { lat: -2.1467, lng: 30.0931 },
  'rwamagana': { lat: -1.9487, lng: 30.4347 },
  'muhanga': { lat: -2.0789, lng: 29.7562 },
  'gitarama': { lat: -2.0789, lng: 29.7562 },
  'kayonza': { lat: -1.9360, lng: 30.5280 },
  'nyanza': { lat: -2.3520, lng: 29.7500 },
  'karongi': { lat: -2.0667, lng: 29.3500 },
  'kibuye': { lat: -2.0667, lng: 29.3500 },
  'rusizi': { lat: -2.4833, lng: 28.9000 },
  'cyangugu': { lat: -2.4833, lng: 28.9000 },
};

/**
 * Generates a stable deterministic pseudo-random offset within a radius (in degrees)
 * so multiple organizations in the same district don't sit directly on top of each other.
 */
function getDeterministicOffset(str: string, maxDegrees = 0.007): { latOff: number; lngOff: number } {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const distance = (((Math.abs(hash >> 3) % 1000) / 1000) * 0.7 + 0.3) * maxDegrees;
  return {
    latOff: Math.sin(angle) * distance,
    lngOff: Math.cos(angle) * distance
  };
}

/**
 * Resolves precise coordinates for an organization in Rwanda.
 * Uses real lat/lng if stored in database; otherwise determines location from address,
 * district, city, or name matches across Kigali and Rwanda.
 */
export function resolveOrgLocation(org: {
  id?: string;
  name?: string;
  address?: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
}): ResolvedOrgLocation {
  // 1. Check if real valid coordinates exist
  if (
    typeof org.latitude === 'number' &&
    typeof org.longitude === 'number' &&
    org.latitude >= -3.0 &&
    org.latitude <= -1.0 &&
    org.longitude >= 28.5 &&
    org.longitude <= 31.2
  ) {
    return {
      lat: org.latitude,
      lng: org.longitude,
      districtName: org.district || org.city || 'Kigali',
      areaLabel: org.address || org.district || 'Verified GPS Location',
      isApproximate: false
    };
  }

  // 2. Search location keywords in address, district, city, name
  const combinedText = `${org.address || ''} ${org.district || ''} ${org.city || ''} ${org.name || ''}`.toLowerCase();
  
  let bestMatchKey = '';
  for (const key of Object.keys(RWANDA_LOCATION_HUBS)) {
    if (combinedText.includes(key)) {
      bestMatchKey = key;
      break;
    }
  }

  const baseCoords = bestMatchKey ? RWANDA_LOCATION_HUBS[bestMatchKey] : KIGALI_DEFAULT_CENTER;
  const offset = getDeterministicOffset(org.id || org.name || 'hifi_org', 0.006);

  return {
    lat: baseCoords.lat + offset.latOff,
    lng: baseCoords.lng + offset.lngOff,
    districtName: org.district || (bestMatchKey ? bestMatchKey.toUpperCase() : 'Kigali'),
    areaLabel: org.address || org.district || (bestMatchKey ? `Near ${bestMatchKey}` : 'Kigali Metropolitan Area'),
    isApproximate: true
  };
}

/**
 * Calculates straight-line Haversine distance between two coordinates in kilometers.
 */
export function calculateDistanceKm(from: GeoCoordinate, to: GeoCoordinate): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance nicely (e.g. "350 m" or "2.4 km")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Estimates driving time in Kigali / Rwanda based on average city speeds (25-30 km/h)
 */
export function estimateDrivingTimeMinutes(distanceKm: number): number {
  const avgSpeedKmh = 25; // Kigali city traffic average
  const hours = distanceKm / avgSpeedKmh;
  const minutes = Math.ceil(hours * 60);
  return Math.max(minutes, 2); // At least 2 minutes
}

/**
 * Formats driving ETA (e.g. "~8 min drive")
 */
export function formatDrivingEta(distanceKm: number): string {
  const mins = estimateDrivingTimeMinutes(distanceKm);
  if (mins < 60) {
    return `~${mins} min drive`;
  }
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `~${hours}h ${remainMins > 0 ? `${remainMins}m` : ''} drive`;
}

/**
 * Builds standard Google Maps web navigation URL
 */
export function buildGoogleMapsNavUrl(dest: GeoCoordinate, destName?: string, origin?: GeoCoordinate | null): string {
  if (origin && typeof origin.lat === 'number' && typeof origin.lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`;
  }
  const query = destName ? `${destName} Rwanda` : `${dest.lat},${dest.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Builds mobile device turn-by-turn navigation intent URL
 */
export function buildMobileNavigationIntent(dest: GeoCoordinate, destName?: string): string {
  return `google.navigation:q=${dest.lat},${dest.lng}`;
}
