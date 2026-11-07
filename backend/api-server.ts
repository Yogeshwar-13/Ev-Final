import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import "dotenv/config";
import { pathToFileURL } from "node:url";
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

const app = express();
const PORT = process.env["PORT"] || 5000;

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const MAX_PAGE_SIZE = 200;

function isPlugCondition(value: unknown): value is Review["plugCondition"] {
  return ["working_perfect", "slow_charge", "broken_connector"].includes(String(value));
}

function parseQueryNumber(
  value: unknown,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseQueryString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
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

function sendError(res: Response, statusCode: number, message: string, details?: unknown) {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(details !== undefined ? { details } : {}),
  });
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

app.get("/api/v1/stations", async (req: Request, res: Response) => {
  const page = parseQueryNumber(req.query["page"], 1, 1, 1000);
  const limit = parseQueryNumber(req.query["limit"], 20, 1, MAX_PAGE_SIZE);
  const city = parseQueryString(req.query["city"]);
  const network = parseQueryString(req.query["network"]);
  const connector = parseQueryString(req.query["connector"]);
  const minPowerKw = parseQueryNumber(req.query["min_power_kw"], 0, 0, 5000);
  const status = parseQueryString(req.query["status"]);
  const q = parseQueryString(req.query["q"]).toLowerCase();
  const { total, data } = await listStations(
    { city, network, connector, minPowerKw, status, q },
    page,
    limit,
  );
  return res.json({
    success: true,
    count: data.length,
    pagination: buildPaginationMeta(page, limit, total),
    data,
  });
});

app.get("/api/v1/stations/cities", async (_req: Request, res: Response) => {
  const cities = await listCities();
  return res.json({ success: true, count: cities.length, data: cities });
});

app.get("/api/v1/stations/nearby", async (req: Request, res: Response) => {
  const lat = parseQueryNumber(req.query["lat"], Number.NaN, -90, 90);
  const lng = parseQueryNumber(req.query["lng"], Number.NaN, -180, 180);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return sendError(res, 400, "Valid lat and lng query params are required");
  }
  const results = await nearbyStations(
    lat,
    lng,
    parseQueryNumber(req.query["radius_km"], 50, 0, 5000),
    parseQueryNumber(req.query["limit"], 100, 1, 500),
    {
      connector: parseQueryString(req.query["connector"]),
      minPowerKw: parseQueryNumber(req.query["min_power_kw"], 0, 0, 5000),
      network: parseQueryString(req.query["network"]),
      status: parseQueryString(req.query["status"]),
    },
  );
  return res.json({ success: true, count: results.length, data: results });
});

app.get("/api/v1/stations/bounds", async (req: Request, res: Response) => {
  const minLat = parseQueryNumber(req.query["min_lat"], Number.NaN, -90, 90);
  const minLng = parseQueryNumber(req.query["min_lng"], Number.NaN, -180, 180);
  const maxLat = parseQueryNumber(req.query["max_lat"], Number.NaN, -90, 90);
  const maxLng = parseQueryNumber(req.query["max_lng"], Number.NaN, -180, 180);
  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(minLng) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(maxLng) ||
    minLat > maxLat ||
    minLng > maxLng
  ) {
    return sendError(res, 400, "Valid map bounds are required");
  }
  const data = await stationsInBounds(
    minLat,
    minLng,
    maxLat,
    maxLng,
    parseQueryNumber(req.query["limit"], 200, 1, 600),
  );
  return res.json({ success: true, count: data.length, data });
});

app.get("/api/v1/stations/search", async (req: Request, res: Response) => {
  const data = await searchStations(
    parseQueryString(req.query["q"]).toLowerCase(),
    parseQueryString(req.query["city"]).toLowerCase(),
    parseQueryNumber(req.query["limit"], 50, 1, 200),
  );
  return res.json({ success: true, count: data.length, data });
});

app.get("/api/v1/stations/:id/reviews", async (req: Request, res: Response) => {
  const stationId = String(req.params["id"]);
  if (!(await getStationById(stationId))) {
    return sendError(res, 404, "Station not found");
  }
  const data = await listStationReviews(stationId);
  return res.json({ success: true, data });
});

app.post("/api/v1/stations/:id/reviews", async (req: Request, res: Response) => {
  const stationId = String(req.params["id"]);
  const { rating, comment, plugCondition, userName } = req.body || {};
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return sendError(res, 400, "Rating must be an integer between 1 and 5");
  }
  if (
    (typeof comment !== "undefined" && typeof comment !== "string") ||
    (typeof userName !== "undefined" && typeof userName !== "string")
  ) {
    return sendError(res, 400, "Review name and comment must be strings");
  }
  if (typeof plugCondition !== "undefined" && !isPlugCondition(plugCondition)) {
    return sendError(res, 400, "Invalid plug condition");
  }
  const station = await getStationById(stationId);
  if (!station) return sendError(res, 404, "Station not found");

  const review = await createReview({
    stationId,
    userName:
      typeof userName === "string" && userName.trim() ? userName.trim().slice(0, 120) : "EV Driver",
    rating: numericRating,
    comment: typeof comment === "string" ? comment.slice(0, 2000) : "",
    plugCondition: typeof plugCondition === "undefined" ? "working_perfect" : plugCondition,
  });
  return res.status(201).json({ success: true, data: review });
});

app.get("/api/v1/stations/:id", async (req: Request, res: Response) => {
  const station = await getStationById(String(req.params["id"]));
  if (!station) return sendError(res, 404, "Station not found");
  const reviews = await listStationReviews(station.id);
  const ports = Array.from({ length: station.totalPorts }, (_, index) => ({
    portNumber: index + 1,
    connectorType: station.connectors[index % station.connectors.length] || "CCS2",
    maxPowerKw: station.maxPowerKw,
    status: index < station.freePorts ? "available" : "occupied",
    pricePerKwh: station.pricePerKwh,
  }));
  return res.json({ success: true, data: { ...station, ports, reviews } });
});

app.post("/api/v1/routes/plan", async (req: Request, res: Response) => {
  const { origin, destination, vehicle } = req.body || {};
  const coordinates = [origin?.lat, origin?.lng, destination?.lat, destination?.lng].map(Number);
  if (
    coordinates.some((coordinate) => !Number.isFinite(coordinate)) ||
    Math.abs(coordinates[0]) > 90 ||
    Math.abs(coordinates[2]) > 90 ||
    Math.abs(coordinates[1]) > 180 ||
    Math.abs(coordinates[3]) > 180
  ) {
    return sendError(res, 400, "Valid origin and destination coordinates are required");
  }

  const [originLat, originLng, destinationLat, destinationLng] = coordinates;
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

  return res.json({
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
});

app.get("/api/v1/health", async (_req: Request, res: Response) => {
  try {
    const totalStationsInDb = await testDatabaseConnection();
    return res.json({
      status: "online",
      database: "connected",
      service: "India EV Finder REST API",
      version: "1.0.0",
      totalStationsInDb,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed", error);
    return res.status(503).json({
      status: "degraded",
      database: "disconnected",
      service: "India EV Finder REST API",
      version: "1.0.0",
      error: "Database unavailable or required schema is incomplete.",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  console.error("API request failed", err);
  const details =
    process.env["NODE_ENV"] === "production"
      ? undefined
      : err instanceof Error
        ? err.message
        : "Internal server error";
  return sendError(res, 500, "Something went wrong while processing the request", details);
});

if (
  process.env["NODE_ENV"] !== "test" &&
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  app.listen(PORT, () => {
    console.log(`EV Finder API listening on http://localhost:${PORT}`);
  });
}

export default app;
