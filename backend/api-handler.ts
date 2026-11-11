import type { Station } from "../src/data/stations";
import {
  createReview,
  getStationById,
  listCities,
  listStationReviews,
  listStations,
  nearbyStations,
  searchStations,
  stationsInBounds,
  testDatabaseConnection,
  type Review,
} from "./database";

const API_PREFIX = "/api/v1";
const MAX_PAGE_SIZE = 200;

function isPlugCondition(value: unknown): value is Review["plugCondition"] {
  return ["working_perfect", "slow_charge", "broken_connector"].includes(String(value));
}

function parseQueryNumber(
  value: string | null,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseQueryString(value: string | null, fallback = "") {
  return value === null ? fallback : value.trim();
}

function buildPaginationMeta(page: number, limit: number, total: number) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
    },
  });
}

function sendError(statusCode: number, message: string, details?: unknown) {
  return jsonResponse(
    {
      success: false,
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    statusCode,
  );
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 100 * 1024) {
    return { error: sendError(413, "Request body must not exceed 100 KB") };
  }
  if (!request.body) return { body: {} };

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 100 * 1024) {
    return { error: sendError(413, "Request body must not exceed 100 KB") };
  }
  try {
    const body: unknown = JSON.parse(text);
    return {
      body: body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {},
    };
  } catch {
    return { error: sendError(400, "Request body must be valid JSON") };
  }
}

async function handleRequest(request: Request) {
  const url = new URL(request.url);
  const route = url.pathname.slice(API_PREFIX.length).replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase() === "HEAD" ? "GET" : request.method.toUpperCase();
  const query = url.searchParams;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonResponse({}).headers });
  }

  if (method === "GET" && route === "/stations") {
    const page = parseQueryNumber(query.get("page"), 1, 1, 1000);
    const limit = parseQueryNumber(query.get("limit"), 20, 1, MAX_PAGE_SIZE);
    const city = parseQueryString(query.get("city"));
    const network = parseQueryString(query.get("network"));
    const connector = parseQueryString(query.get("connector"));
    const minPowerKw = parseQueryNumber(query.get("min_power_kw"), 0, 0, 5000);
    const status = parseQueryString(query.get("status"));
    const q = parseQueryString(query.get("q")).toLowerCase();
    const { total, data } = await listStations(
      { city, network, connector, minPowerKw, status, q },
      page,
      limit,
    );
    return jsonResponse({
      success: true,
      count: data.length,
      pagination: buildPaginationMeta(page, limit, total),
      data,
    });
  }

  if (method === "GET" && route === "/stations/cities") {
    const cities = await listCities();
    return jsonResponse({ success: true, count: cities.length, data: cities });
  }

  if (method === "GET" && route === "/stations/nearby") {
    const lat = parseQueryNumber(query.get("lat"), Number.NaN, -90, 90);
    const lng = parseQueryNumber(query.get("lng"), Number.NaN, -180, 180);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return sendError(400, "Valid lat and lng query params are required");
    }
    const results = await nearbyStations(
      lat,
      lng,
      parseQueryNumber(query.get("radius_km"), 50, 0, 5000),
      parseQueryNumber(query.get("limit"), 100, 1, 500),
      {
        connector: parseQueryString(query.get("connector")),
        minPowerKw: parseQueryNumber(query.get("min_power_kw"), 0, 0, 5000),
        network: parseQueryString(query.get("network")),
        status: parseQueryString(query.get("status")),
      },
    );
    return jsonResponse({ success: true, count: results.length, data: results });
  }

  if (method === "GET" && route === "/stations/bounds") {
    const minLat = parseQueryNumber(query.get("min_lat"), Number.NaN, -90, 90);
    const minLng = parseQueryNumber(query.get("min_lng"), Number.NaN, -180, 180);
    const maxLat = parseQueryNumber(query.get("max_lat"), Number.NaN, -90, 90);
    const maxLng = parseQueryNumber(query.get("max_lng"), Number.NaN, -180, 180);
    if (
      !Number.isFinite(minLat) ||
      !Number.isFinite(minLng) ||
      !Number.isFinite(maxLat) ||
      !Number.isFinite(maxLng) ||
      minLat > maxLat ||
      minLng > maxLng
    ) {
      return sendError(400, "Valid map bounds are required");
    }
    const data = await stationsInBounds(
      minLat,
      minLng,
      maxLat,
      maxLng,
      parseQueryNumber(query.get("limit"), 200, 1, 600),
    );
    return jsonResponse({ success: true, count: data.length, data });
  }

  if (method === "GET" && route === "/stations/search") {
    const data = await searchStations(
      parseQueryString(query.get("q")).toLowerCase(),
      parseQueryString(query.get("city")).toLowerCase(),
      parseQueryNumber(query.get("limit"), 50, 1, 200),
    );
    return jsonResponse({ success: true, count: data.length, data });
  }

  const reviewMatch = /^\/stations\/([^/]+)\/reviews$/.exec(route);
  if (reviewMatch && (method === "GET" || method === "POST")) {
    let stationId: string;
    try {
      stationId = decodeURIComponent(reviewMatch[1] ?? "");
    } catch {
      return sendError(400, "Invalid station ID");
    }
    if (method === "GET") {
      if (!(await getStationById(stationId))) return sendError(404, "Station not found");
      const data = await listStationReviews(stationId);
      return jsonResponse({ success: true, data });
    }

    const parsedBody = await readJsonBody(request);
    if (parsedBody.error) return parsedBody.error;
    const { rating, comment, plugCondition, userName } = parsedBody.body as {
      rating?: unknown;
      comment?: unknown;
      plugCondition?: unknown;
      userName?: unknown;
    };
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return sendError(400, "Rating must be an integer between 1 and 5");
    }
    if (
      (typeof comment !== "undefined" && typeof comment !== "string") ||
      (typeof userName !== "undefined" && typeof userName !== "string")
    ) {
      return sendError(400, "Review name and comment must be strings");
    }
    if (typeof plugCondition !== "undefined" && !isPlugCondition(plugCondition)) {
      return sendError(400, "Invalid plug condition");
    }
    const station = await getStationById(stationId);
    if (!station) return sendError(404, "Station not found");

    const review = await createReview({
      stationId,
      userName:
        typeof userName === "string" && userName.trim()
          ? userName.trim().slice(0, 120)
          : "EV Driver",
      rating: numericRating,
      comment: typeof comment === "string" ? comment.slice(0, 2000) : "",
      plugCondition: typeof plugCondition === "undefined" ? "working_perfect" : plugCondition,
    });
    return jsonResponse({ success: true, data: review }, 201);
  }

  const stationMatch = /^\/stations\/([^/]+)$/.exec(route);
  if (stationMatch && method === "GET") {
    let stationId: string;
    try {
      stationId = decodeURIComponent(stationMatch[1] ?? "");
    } catch {
      return sendError(400, "Invalid station ID");
    }
    const station = await getStationById(stationId);
    if (!station) return sendError(404, "Station not found");
    const reviews = await listStationReviews(station.id);
    const ports = Array.from({ length: station.totalPorts }, (_, index) => ({
      portNumber: index + 1,
      connectorType: station.connectors[index % station.connectors.length] || "CCS2",
      maxPowerKw: station.maxPowerKw,
      status: index < station.freePorts ? "available" : "occupied",
      pricePerKwh: station.pricePerKwh,
    }));
    return jsonResponse({ success: true, data: { ...station, ports, reviews } });
  }

  if (method === "POST" && route === "/routes/plan") {
    const parsedBody = await readJsonBody(request);
    if (parsedBody.error) return parsedBody.error;
    const { origin, destination, vehicle } = parsedBody.body as {
      origin?: { lat?: unknown; lng?: unknown };
      destination?: { lat?: unknown; lng?: unknown };
      vehicle?: { batteryKwh?: unknown; currentSocPercent?: unknown; efficiencyKmPerKwh?: unknown };
    };
    const coordinates = [origin?.lat, origin?.lng, destination?.lat, destination?.lng].map(Number);
    if (
      coordinates.some((coordinate) => !Number.isFinite(coordinate)) ||
      Math.abs(coordinates[0] ?? 0) > 90 ||
      Math.abs(coordinates[2] ?? 0) > 90 ||
      Math.abs(coordinates[1] ?? 0) > 180 ||
      Math.abs(coordinates[3] ?? 0) > 180
    ) {
      return sendError(400, "Valid origin and destination coordinates are required");
    }

    const [
      originLat = Number.NaN,
      originLng = Number.NaN,
      destinationLat = Number.NaN,
      destinationLng = Number.NaN,
    ] = coordinates;
    const totalDistanceKm = haversineKm(originLat, originLng, destinationLat, destinationLng);
    const batteryKwh = Number(vehicle?.batteryKwh) || 40.5;
    const currentSoc = Number(vehicle?.currentSocPercent) || 70;
    const efficiency = Number(vehicle?.efficiencyKmPerKwh) || 6.5;
    const usableRangeKm = ((batteryKwh * currentSoc) / 100) * efficiency;
    const stopsNeeded = totalDistanceKm > usableRangeKm;
    const recommendedStops: {
      stopNumber: number;
      station: Station;
      estimatedArrivalSoc: number;
      targetChargeSoc: number;
      chargeTimeMinutes: number;
      estimatedCostInr: number;
    }[] = [];

    if (stopsNeeded) {
      const midpointLat = (originLat + destinationLat) / 2;
      const midpointLng = (originLng + destinationLng) / 2;
      const candidates = await nearbyStations(midpointLat, midpointLng, 5000, 3, {
        minPowerKw: 30,
      });
      const station = candidates[0];
      if (station) {
        recommendedStops.push({
          stopNumber: 1,
          station,
          estimatedArrivalSoc: 22,
          targetChargeSoc: 80,
          chargeTimeMinutes: 30,
          estimatedCostInr: Math.round(30 * (station.pricePerKwh || 18)),
        });
      }
    }

    return jsonResponse({
      success: true,
      data: {
        totalDistanceKm,
        estimatedDriveTimeMinutes: Math.round((totalDistanceKm / 65) * 60),
        stopsNeeded,
        recommendedStops,
        arrivalDestinationSocPercent: stopsNeeded
          ? 52
          : Math.max(
              10,
              Math.round(((usableRangeKm - totalDistanceKm) / (batteryKwh * efficiency)) * 100),
            ),
      },
    });
  }

  if (method === "GET" && route === "/health") {
    try {
      const totalStationsInDb = await testDatabaseConnection();
      return jsonResponse({
        status: "online",
        database: "connected",
        service: "India EV Finder REST API",
        version: "1.0.0",
        totalStationsInDb,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Database health check failed", error);
      return jsonResponse(
        {
          status: "degraded",
          database: "disconnected",
          service: "India EV Finder REST API",
          version: "1.0.0",
          error: "Database unavailable or required schema is incomplete.",
          timestamp: new Date().toISOString(),
        },
        503,
      );
    }
  }

  return sendError(404, "API endpoint not found");
}

export async function handleApiRequest(request: Request) {
  try {
    const response = await handleRequest(request);
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  } catch (error) {
    console.error("API request failed", error);
    const details =
      process.env["NODE_ENV"] === "production"
        ? undefined
        : error instanceof Error
          ? error.message
          : "Internal server error";
    return sendError(500, "Something went wrong while processing the request", details);
  }
}
