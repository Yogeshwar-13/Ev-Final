import { stations as fallbackStations, Station, cityCoordinates } from "../data/stations";

const runtimeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;
const configuredApiUrl = import.meta.env["VITE_API_URL"];
const browserApiUrl =
  typeof window !== "undefined"
    ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:5000/api/v1"
      : `${window.location.origin}/api/v1`
    : undefined;
const deployedServerApiUrl = runtimeEnv?.["VERCEL_URL"]
  ? `https://${runtimeEnv["VERCEL_URL"]}/api/v1`
  : undefined;
const API_BASE_URL =
  configuredApiUrl || browserApiUrl || deployedServerApiUrl || "http://localhost:5000/api/v1";

const LEGACY_API_BASE_URL = "http://localhost/api";
const canUseLegacyApi =
  typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

export interface FetchStationsResult {
  data: Station[];
  isLiveDb: boolean;
  source: "xampp_mysql" | "local_fallback";
  error?: string;
}

// Mapping of substrings/districts/aliases to clean major cities
const CITY_NAME_MAP: [RegExp, string][] = [
  [/bengaluru|bangalore/i, "Bengaluru"],
  [/mumbai|bombay|navi mumbai|thane|borivali|andheri|nariman/i, "Mumbai"],
  [
    /new delhi|delhi|noida|greater noida|gurugram|gurgaon|faridabad|ghaziabad|dwarka|saket|connaught/i,
    "New Delhi",
  ],
  [/hyderabad|secunderabad|gachibowli|hitec city/i, "Hyderabad"],
  [/chennai|madras|guindy|omr|velachery/i, "Chennai"],
  [/pune|pimpri|chinchwad|hinjewadi|wakad|baner/i, "Pune"],
  [/kolkata|calcutta|howrah|salt lake|new town/i, "Kolkata"],
  [/ahmedabad|gandhinagar|sg highway/i, "Ahmedabad"],
  [/jaipur|mansarovar|vaishali nagar/i, "Jaipur"],
  [/kochi|cochin|ernakulam|kakkanad|edappally/i, "Kochi"],
  [/chandigarh|mohali|panchkula/i, "Chandigarh"],
  [/lucknow|gomti nagar|hazratganj/i, "Lucknow"],
  [/surat/i, "Surat"],
  [/indore/i, "Indore"],
  [/coimbatore/i, "Coimbatore"],
  [/goa|panaji|margao|calangute|candolim|mapusa|vasco/i, "Goa"],
  [/nagpur/i, "Nagpur"],
  [/vadodara|baroda/i, "Vadodara"],
  [/bhopal/i, "Bhopal"],
  [/visakhapatnam|vizag/i, "Visakhapatnam"],
  [/patna/i, "Patna"],
  [/agra/i, "Agra"],
  [/varanasi|banaras|kashi/i, "Varanasi"],
  [/amritsar/i, "Amritsar"],
  [/bhubaneswar|cuttack/i, "Bhubaneswar"],
  [/guwahati/i, "Guwahati"],
  [/dehradun/i, "Dehradun"],
  [/thiruvananthapuram|trivandrum/i, "Thiruvananthapuram"],
  [/mysore|mysuru/i, "Mysore"],
  [/mangalore|mangaluru/i, "Mangalore"],
  [/ludhiana/i, "Ludhiana"],
  [/kanpur/i, "Kanpur"],
  [/nashik/i, "Nashik"],
  [/rajkot/i, "Rajkot"],
  [/vijayawada/i, "Vijayawada"],
  [/madurai/i, "Madurai"],
  [/raipur/i, "Raipur"],
  [/ranchi/i, "Ranchi"],
  [/jodhpur/i, "Jodhpur"],
  [/udaipur/i, "Udaipur"],
];

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function cleanCityName(
  rawCity: string,
  rawAddress: string,
  rawName: string,
  lat?: number,
  lng?: number,
): string {
  const combined = `${rawCity || ""} ${rawAddress || ""} ${rawName || ""}`;

  // 1. Check known city name patterns in combined text
  for (const [regex, cleanName] of CITY_NAME_MAP) {
    if (regex.test(combined)) {
      return cleanName;
    }
  }

  // 2. Proximity to known major city centers (within 45 km radius)
  if (lat && lng && !isNaN(lat) && !isNaN(lng) && lat !== 0) {
    let closestCity = "";
    let minDistance = 45; // 45km max radius for metro/city cluster

    for (const [cityName, coords] of Object.entries(cityCoordinates)) {
      const dist = getDistanceKm(lat, lng, coords.lat, coords.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestCity = cityName;
      }
    }

    if (closestCity) {
      return closestCity;
    }
  }

  // 3. Fallback: Clean up raw city if it's a simple reasonable word
  if (rawCity) {
    let c = rawCity.trim();
    c = c.replace(/^[0-9\-\+\s]+/, "").trim();
    if (c.includes(",")) c = c.split(",")[0]?.trim() || "";
    if (c.includes(":")) c = c.split(":")[0]?.trim() || "";
    if (
      c.length > 20 ||
      /dealer|service|station|industrial|highway|toll|sector|opposite|petroleum/i.test(c)
    ) {
      if (rawAddress) {
        const parts = rawAddress
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        for (let i = parts.length - 1; i >= 0; i--) {
          const part = parts[i] || "";
          if (part.length > 2 && part.length < 20 && !/^\d+$/.test(part) && !/india/i.test(part)) {
            return part;
          }
        }
      }
    }
    if (c.length > 2 && c.length <= 25) {
      return c;
    }
  }

  return "Bengaluru";
}

/**
 * Normalizes raw SQL database records into standard Station objects
 */
export function normalizeStation(raw: any): Station {
  let connectors: string[] = [];
  if (Array.isArray(raw.connectors)) {
    connectors = raw.connectors;
  } else if (typeof raw.connectors === "string") {
    try {
      connectors = JSON.parse(raw.connectors);
    } catch {
      // In case it's comma separated
      connectors = raw.connectors.split(",").map((c: string) => c.trim());
    }
  }

  let amenities: string[] = [];
  if (Array.isArray(raw.amenities)) {
    amenities = raw.amenities;
  } else if (typeof raw.amenities === "string") {
    try {
      amenities = JSON.parse(raw.amenities);
    } catch {
      amenities = raw.amenities.split(",").map((a: string) => a.trim());
    }
  }

  const lat = Number(raw.lat || raw.latitude) || 20.5937;
  const lng = Number(raw.lng || raw.longitude) || 78.9629;
  const rawCity = String(raw.city || "");
  const rawAddress = String(raw.address || "");
  const rawName = String(raw.name || "");

  const cleanCity = cleanCityName(rawCity, rawAddress, rawName, lat, lng);

  return {
    id: String(raw.id || raw.place_id || `st-${Math.random().toString(36).substring(2, 9)}`),
    name: rawName || "EV Charging Station",
    network: String(raw.network || "Public Charger"),
    city: cleanCity,
    state: String(raw.state || "India"),
    address: rawAddress,
    pincode: String(raw.pincode || ""),
    lat,
    lng,
    distanceKm: Number(raw.distanceKm) || 0,
    status: ["available", "limited", "busy", "offline"].includes(raw.status)
      ? raw.status
      : "available",
    freePorts: Number(raw.freePorts ?? 1),
    totalPorts: Number(raw.totalPorts ?? 2),
    connectors: connectors.length > 0 ? connectors : ["CCS2"],
    maxPowerKw: Number(raw.maxPowerKw || 50),
    pricePerKwh: Number(raw.pricePerKwh || 10),
    hours: String(raw.hours || "24×7"),
    amenities: amenities.length > 0 ? amenities : ["Restrooms"],
    rating: Number(raw.rating || 4.5),
    reviews: Number(raw.reviews || 0),
  };
}

/**
 * Fetches all EV stations from the Node.js API backend,
 * with automatic fallback to the legacy PHP endpoint and then the local dataset.
 */
export async function fetchStations(): Promise<FetchStationsResult> {
  try {
    const fetchPage = async (page: number) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(`${API_BASE_URL}/stations?page=${page}&limit=200`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const payload = await response.json();
        if (!payload?.success || !Array.isArray(payload.data)) {
          throw new Error("API did not return a valid station list");
        }
        return {
          data: payload.data as Station[],
          totalPages: Number(payload.pagination?.totalPages) || 1,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const firstPage = await fetchPage(1);
    const allStations = [...firstPage.data];
    for (let page = 2; page <= firstPage.totalPages; page += 4) {
      const pages = Array.from(
        { length: Math.min(4, firstPage.totalPages - page + 1) },
        (_, index) => page + index,
      );
      const results = await Promise.all(pages.map(fetchPage));
      results.forEach((result) => allStations.push(...result.data));
    }

    return {
      data: allStations,
      isLiveDb: true,
      source: "xampp_mysql",
    };
  } catch (err: any) {
    if (!canUseLegacyApi) {
      return {
        data: fallbackStations,
        isLiveDb: false,
        source: "local_fallback",
        error: err?.message,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${LEGACY_API_BASE_URL}/get_stations.php`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();

      if (!Array.isArray(rawData)) {
        throw new Error("Legacy PHP API did not return an array of stations");
      }

      const normalized = rawData.map(normalizeStation);

      return {
        data: normalized,
        isLiveDb: true,
        source: "xampp_mysql",
      };
    } catch (legacyErr: any) {
      return {
        data: fallbackStations,
        isLiveDb: false,
        source: "local_fallback",
        error: legacyErr?.message || err?.message,
      };
    }
  }
}

/**
 * Fetches a single station by its ID
 */
export async function fetchStationById(id: string): Promise<Station | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/stations/${id}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    if (!rawData || !rawData.success || !rawData.data) {
      throw new Error("API did not return a valid station");
    }

    return rawData.data as Station;
  } catch {
    const result = await fetchStations();
    return result.data.find((s) => s.id === id) || null;
  }
}
