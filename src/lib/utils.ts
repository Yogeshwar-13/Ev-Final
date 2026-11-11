import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cityCoordinates } from "../data/stations";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CANONICAL_CITY_ALIASES: Record<string, string> = {
  delhi: "New Delhi",
  "new delhi": "New Delhi",
  bengaluru: "Bengaluru",
  bangalore: "Bengaluru",
  mumbai: "Mumbai",
  bombay: "Mumbai",
  chennai: "Chennai",
  madras: "Chennai",
  kolkata: "Kolkata",
  calcutta: "Kolkata",
  kochi: "Kochi",
  cochin: "Kochi",
  ernakulam: "Kochi",
  mysore: "Mysore",
  mysuru: "Mysore",
  mangalore: "Mangalore",
  mangaluru: "Mangalore",
  vadodara: "Vadodara",
  baroda: "Vadodara",
  varanasi: "Varanasi",
  banaras: "Varanasi",
  kashi: "Varanasi",
  visakhapatnam: "Visakhapatnam",
  vizag: "Visakhapatnam",
  gurugram: "Gurugram",
  gurgaon: "Gurugram",
  noida: "Noida",
  "greater noida": "Noida",
};

/**
 * Validates whether a station belongs to the target city filter.
 * Prevents false matches (e.g. Chennai stations showing in Mumbai, or Delhi stations showing in Gurugram).
 */
export function matchesCity(
  station: { city?: string | null; state?: string | null; lat?: number | null; lng?: number | null },
  targetCity: string | undefined | null
): boolean {
  if (!targetCity || targetCity === "All India" || targetCity.toLowerCase() === "all") {
    return true;
  }

  const cleanTarget = targetCity.trim().toLowerCase();
  const stationCity = (station.city || "").trim().toLowerCase();

  // 1. Direct state match (e.g. filtering by a state like "Goa" or "Kerala")
  if (station.state && station.state.toLowerCase() === cleanTarget) {
    return true;
  }

  const canonicalTarget = (CANONICAL_CITY_ALIASES[cleanTarget] || targetCity.trim()).toLowerCase();
  const canonicalStation = (CANONICAL_CITY_ALIASES[stationCity] || (station.city || "").trim()).toLowerCase();

  // 2. Check if city or canonical alias matches
  const nameMatches =
    stationCity === cleanTarget ||
    canonicalStation === canonicalTarget ||
    stationCity.includes(cleanTarget) ||
    cleanTarget.includes(stationCity);

  // 3. Physical GPS coordinate check against target city
  if (
    station.lat !== undefined &&
    station.lat !== null &&
    station.lng !== undefined &&
    station.lng !== null &&
    !isNaN(station.lat) &&
    !isNaN(station.lng)
  ) {
    const targetCoord =
      cityCoordinates[CANONICAL_CITY_ALIASES[cleanTarget] || targetCity.trim()];
    if (targetCoord) {
      const dist = calculateDistanceKm(station.lat, station.lng, targetCoord.lat, targetCoord.lng);
      // Hard cutoff: Station must be within 75km of the target city center
      if (dist > 75) {
        return false;
      }
      if (nameMatches) {
        return true;
      }

      // If station explicitly belongs to another major city in the region, do not cross-match
      // (e.g., Gurugram stations shouldn't bleed into New Delhi or vice-versa)
      const majorCitySet = new Set(Object.keys(cityCoordinates).map((c) => c.toLowerCase()));
      if (majorCitySet.has(canonicalStation) && canonicalStation !== canonicalTarget) {
        return false;
      }

      // For unmapped suburbs/localities within 35km of city center
      return dist <= 35;
    }
  }

  return nameMatches;
}

/**
 * Robust, fuzzy connector matching for all Indian EV standards and variants
 */
export function matchesConnector(
  stationConnectors: string[] | undefined,
  target: string | undefined,
  stationNetwork?: string
): boolean {
  if (!target) return true;
  if (!stationConnectors || stationConnectors.length === 0) {
    return true;
  }

  const cleanTarget = target.trim().toLowerCase().replace(/[\s\-_/]/g, "");

  return stationConnectors.some((rawConn) => {
    const conn = rawConn.trim().toLowerCase().replace(/[\s\-_/]/g, "");

    // Exact or direct inclusion
    if (conn === cleanTarget || conn.includes(cleanTarget) || cleanTarget.includes(conn)) {
      return true;
    }

    // CCS2 / Combo 2 / DC Fast
    if (
      (cleanTarget.includes("ccs") || cleanTarget === "ccs2" || cleanTarget.includes("combo")) &&
      (conn.includes("ccs") || conn.includes("combo"))
    ) {
      return true;
    }

    // Type 2 AC / Mennekes
    if (
      (cleanTarget.includes("type2") || cleanTarget.includes("mennekes")) &&
      (conn.includes("type2") || conn.includes("mennekes"))
    ) {
      return true;
    }

    // GB/T / Bharat DC-001 / GBT / DC-001
    if (
      (cleanTarget.includes("gbt") || cleanTarget.includes("bharatdc") || cleanTarget.includes("dc001")) &&
      (conn.includes("gbt") || conn.includes("bharatdc") || conn.includes("dc001"))
    ) {
      return true;
    }

    // 15A Socket / Bharat AC-001 / 3-Pin / Standard Wall Socket
    if (
      (cleanTarget.includes("15a") || cleanTarget.includes("bharatac") || cleanTarget.includes("ac001") || cleanTarget.includes("socket") || cleanTarget.includes("3pin")) &&
      (conn.includes("15a") || conn.includes("bharatac") || conn.includes("ac001") || conn.includes("socket"))
    ) {
      return true;
    }

    // LECCS / Light EV / Ather / 2-wheeler
    if (
      cleanTarget.includes("leccs") || cleanTarget.includes("ather") || cleanTarget.includes("lightev")
    ) {
      return (
        conn.includes("leccs") ||
        conn.includes("ather") ||
        Boolean(stationNetwork && stationNetwork.toLowerCase().includes("ather"))
      );
    }

    // CHAdeMO
    if (cleanTarget.includes("chademo") && conn.includes("chademo")) {
      return true;
    }

    return false;
  });
}

/**
 * Calculates Haversine distance in Kilometers between two GPS coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Finds the closest major Indian city to the user's coordinates
 */
export function getClosestCity(
  lat: number,
  lng: number,
  coordsMap: Record<string, { lat: number; lng: number }>
): string {
  let closestCity = "Bengaluru";
  let minDistance = Infinity;

  for (const [cityName, coords] of Object.entries(coordsMap)) {
    const dist = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestCity = cityName;
    }
  }

  return closestCity;
}

