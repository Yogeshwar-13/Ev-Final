import { randomUUID } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import type { Station } from "../src/data/stations";

export interface Review {
  id: string;
  stationId: string;
  userName: string;
  rating: number;
  comment: string;
  plugCondition: "working_perfect" | "slow_charge" | "broken_connector";
  createdAt: string;
}

type StationFilters = {
  city?: string;
  network?: string;
  connector?: string;
  minPowerKw?: number;
  status?: string;
  q?: string;
};

type StationRow = RowDataPacket & {
  id: string;
  name: string;
  network: string;
  city: string;
  state: string;
  address: string;
  pincode: string | null;
  lat: number | string;
  lng: number | string;
  distanceKm: number | string;
  status: Station["status"];
  freePorts: number | string;
  totalPorts: number | string;
  connectors: string[] | string;
  maxPowerKw: number | string;
  pricePerKwh: number | string;
  hours: string;
  amenities: string[] | string;
  rating: number | string;
  reviews: number | string;
};

const globalForMysql = globalThis as typeof globalThis & {
  evFinderMysqlPool?: mysql.Pool;
};

function getPool() {
  if (!globalForMysql.evFinderMysqlPool) {
    const connectionLimit = Number(process.env["DB_CONNECTION_LIMIT"] || 5);
    const ssl = process.env["DB_SSL"] === "true" ? { rejectUnauthorized: true } : undefined;
    const databaseUrl = process.env["DATABASE_URL"];

    if (databaseUrl) {
      const url = new URL(databaseUrl);
      if (!["mysql:", "mysqls:"].includes(url.protocol)) {
        throw new Error("DATABASE_URL must use the mysql:// or mysqls:// protocol.");
      }
      globalForMysql.evFinderMysqlPool = mysql.createPool({
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.replace(/^\//, "")),
        connectionLimit,
        waitForConnections: true,
        queueLimit: 0,
        timezone: "Z",
        ...(ssl || url.protocol === "mysqls:" ? { ssl: ssl || { rejectUnauthorized: true } } : {}),
      });
    } else {
      const host = process.env["DB_HOST"];
      const user = process.env["DB_USER"];
      const database = process.env["DB_NAME"];
      if (!host || !user || !database) {
        throw new Error(
          "Database is not configured. Set DATABASE_URL or DB_HOST, DB_USER, and DB_NAME.",
        );
      }
      globalForMysql.evFinderMysqlPool = mysql.createPool({
        host,
        port: Number(process.env["DB_PORT"] || 3306),
        user,
        password: process.env["DB_PASSWORD"] || "",
        database,
        connectionLimit,
        waitForConnections: true,
        queueLimit: 0,
        enableKeepAlive: true,
        timezone: "Z",
        ...(ssl ? { ssl } : {}),
      });
    }
  }
  return globalForMysql.evFinderMysqlPool;
}

function parseJsonArray(value: string[] | string) {
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function normalizeStation(row: StationRow): Station {
  return {
    id: row.id,
    name: row.name,
    network: row.network,
    city: row.city,
    state: row.state,
    address: row.address,
    pincode: row.pincode || "",
    lat: Number(row.lat),
    lng: Number(row.lng),
    distanceKm: Number(row.distanceKm),
    status: row.status,
    freePorts: Number(row.freePorts),
    totalPorts: Number(row.totalPorts),
    connectors: parseJsonArray(row.connectors),
    maxPowerKw: Number(row.maxPowerKw),
    pricePerKwh: Number(row.pricePerKwh),
    hours: row.hours,
    amenities: parseJsonArray(row.amenities),
    rating: Number(row.rating),
    reviews: Number(row.reviews),
  };
}

const stationColumns =
  "`id`, `name`, `network`, `city`, `state`, `address`, `pincode`, `lat`, `lng`, `distanceKm`, `status`, `freePorts`, `totalPorts`, `connectors`, `maxPowerKw`, `pricePerKwh`, `hours`, `amenities`, `rating`, `reviews`";

function buildStationWhere(filters: StationFilters) {
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  if (filters.city && !["all", "all india"].includes(filters.city.toLowerCase())) {
    clauses.push("`city` LIKE ?");
    values.push(`%${filters.city}%`);
  }
  if (filters.network && filters.network.toLowerCase() !== "all") {
    clauses.push("`network` LIKE ?");
    values.push(`%${filters.network}%`);
  }
  if (filters.connector) {
    clauses.push("JSON_SEARCH(`connectors`, 'one', ?) IS NOT NULL");
    values.push(`%${filters.connector}%`);
  }
  if (filters.minPowerKw && filters.minPowerKw > 0) {
    clauses.push("`maxPowerKw` >= ?");
    values.push(filters.minPowerKw);
  }
  if (filters.status && filters.status.toLowerCase() !== "all") {
    clauses.push("`status` = ?");
    values.push(filters.status);
  }
  if (filters.q) {
    clauses.push(
      "(`name` LIKE ? OR `city` LIKE ? OR `address` LIKE ? OR `network` LIKE ? OR `pincode` LIKE ?)",
    );
    const term = `%${filters.q}%`;
    values.push(term, term, term, term, term);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
}

export async function testDatabaseConnection() {
  const pool = getPool();
  const [results] = await Promise.all([
    pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM `ev_stations`"),
    pool.execute<(RowDataPacket & { table_name: string })[]>(
      "SELECT `table_name` FROM `information_schema`.`tables` WHERE `table_schema` = DATABASE() AND `table_name` IN (?, ?)",
      ["ev_stations", "ev_reviews"],
    ),
  ]);
  const [[countRows], [tables]] = results;
  if (tables.length !== 2) {
    throw new Error("Database schema is incomplete. Import the latest backend/schema.sql file.");
  }
  return Number(countRows[0]?.["total"] || 0);
}

export async function listStations(filters: StationFilters, page: number, limit: number) {
  const pool = getPool();
  const where = buildStationWhere(filters);
  const [[countRows], [stationRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM \`ev_stations\` ${where.sql}`,
      where.values,
    ),
    pool.query<StationRow[]>(
      `SELECT ${stationColumns} FROM \`ev_stations\` ${where.sql} ORDER BY \`city\`, \`name\` LIMIT ? OFFSET ?`,
      [...where.values, limit, (page - 1) * limit],
    ),
  ]);
  return { total: Number(countRows[0]?.["total"] || 0), data: stationRows.map(normalizeStation) };
}

export async function listCities() {
  const [rows] = await getPool().query<(RowDataPacket & { city: string })[]>(
    "SELECT DISTINCT `city` FROM `ev_stations` WHERE `city` <> '' ORDER BY `city`",
  );
  return rows.map((row) => row.city);
}

export async function getStationById(id: string) {
  const [rows] = await getPool().execute<StationRow[]>(
    `SELECT ${stationColumns} FROM \`ev_stations\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? normalizeStation(rows[0]) : null;
}

export async function searchStations(q: string, city: string, limit: number) {
  const where = buildStationWhere({ q, city });
  const [rows] = await getPool().query<StationRow[]>(
    `SELECT ${stationColumns} FROM \`ev_stations\` ${where.sql} ORDER BY \`name\` LIMIT ?`,
    [...where.values, limit],
  );
  return rows.map(normalizeStation);
}

export async function stationsInBounds(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  limit: number,
) {
  const [rows] = await getPool().execute<StationRow[]>(
    `SELECT ${stationColumns} FROM \`ev_stations\`
     WHERE \`lat\` BETWEEN ? AND ? AND \`lng\` BETWEEN ? AND ?
     ORDER BY \`city\`, \`name\` LIMIT ?`,
    [minLat, maxLat, minLng, maxLng, limit],
  );
  return rows.map(normalizeStation);
}

export async function nearbyStations(
  lat: number,
  lng: number,
  radiusKm: number,
  limit: number,
  filters: StationFilters = {},
) {
  const where = buildStationWhere(filters);
  const distance =
    "(6371 * ACOS(LEAST(1, GREATEST(-1, COS(RADIANS(?)) * COS(RADIANS(`lat`)) * COS(RADIANS(`lng`) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(`lat`))))))";
  const [rows] = await getPool().query<(StationRow & { distanceFromLocation: number | string })[]>(
    `SELECT ${stationColumns}, ${distance} AS \`distanceFromLocation\` FROM \`ev_stations\`
     ${where.sql}
     HAVING \`distanceFromLocation\` <= ?
     ORDER BY \`distanceFromLocation\` LIMIT ?`,
    [lat, lng, lat, ...where.values, radiusKm, limit],
  );
  return rows.map((row) => ({
    ...normalizeStation(row),
    distanceKm: Number(row.distanceFromLocation),
  }));
}

export async function listStationReviews(stationId: string) {
  const [rows] = await getPool().execute<
    (RowDataPacket & {
      id: string;
      station_id: string;
      user_name: string;
      rating: number | string;
      comment: string;
      plug_condition: Review["plugCondition"];
      created_at: string;
    })[]
  >(
    "SELECT `id`, `station_id`, `user_name`, `rating`, `comment`, `plug_condition`, `created_at` FROM `ev_reviews` WHERE `station_id` = ? ORDER BY `created_at` DESC",
    [stationId],
  );
  return rows.map((row): Review => ({
    id: row.id,
    stationId: row.station_id,
    userName: row.user_name,
    rating: Number(row.rating),
    comment: row.comment,
    plugCondition: row.plug_condition,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function createReview(review: Omit<Review, "id" | "createdAt">) {
  const pool = getPool();
  const id = `rev_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [stationRows] = await connection.execute<
      (RowDataPacket & { rating: number | string; reviews: number | string })[]
    >("SELECT `rating`, `reviews` FROM `ev_stations` WHERE `id` = ? FOR UPDATE", [
      review.stationId,
    ]);
    const station = stationRows[0];
    if (!station) throw new Error("Station not found.");
    const oldCount = Number(station.reviews);
    const newCount = oldCount + 1;
    const average = (Number(station.rating) * oldCount + review.rating) / newCount;
    await connection.execute(
      "INSERT INTO `ev_reviews` (`id`, `station_id`, `user_id`, `user_name`, `rating`, `comment`, `plug_condition`) VALUES (?, ?, NULL, ?, ?, ?, ?)",
      [id, review.stationId, review.userName, review.rating, review.comment, review.plugCondition],
    );
    await connection.execute(
      "UPDATE `ev_stations` SET `rating` = ?, `reviews` = ? WHERE `id` = ?",
      [average, newCount, review.stationId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { ...review, id, createdAt };
}
