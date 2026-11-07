# EV Finder — Project Overview

## Project purpose

EV Finder is a location-based web app for discovering EV charging stations across India. It helps users search, filter, and compare charging stations by city, connector type, power, availability, and price.

The app is designed for quick station discovery and a clean map-first user experience for EV drivers.

---

## What the project includes

- Web frontend for browsing and filtering stations
- Map-based station discovery
- Station detail pages with key charging information
- Search and city-level browsing
- Responsive UI for desktop and mobile-friendly layouts
- API layer for station data and user interactions
- Mobile app shell using the same domain model and API flow

---

## Main architecture

### Frontend

- React + TypeScript + Vite
- TanStack Router for page navigation
- TanStack Query for data fetching
- Tailwind CSS and shadcn/ui for components
- Leaflet for map rendering

### Backend

- Node.js + Express + TypeScript
- JWT-based authentication for protected routes
- In-memory demo data and optional database-backed extension
- Legacy PHP/MySQL file remains as a reference, but the modern API path is the TypeScript server in `backend/api-server.ts`

### Mobile app

- Expo React Native app under `mobile/`
- Separate UI layer, but same domain concepts: stations, filters, favorites, user profile

---

## Project structure

```text
Ev-Finder/
├── src/                     # Web app UI and route pages
│   ├── components/         # Reusable web components
│   ├── data/               # Station dataset and local fallback data
│   ├── hooks/              # Query hooks and app logic
│   ├── lib/                # API client and shared helpers
│   └── routes/             # Route pages
├── backend/                # API server and data-related utilities
│   ├── api-server.ts       # Main TypeScript REST API
│   ├── get_stations.php    # Legacy PHP endpoint
│   ├── schema.sql          # Database schema/reference seed
│   └── openapi.json        # API contract reference
├── mobile/                 # Expo mobile app
├── scripts/                # CSV/import utilities
├── public/                 # Static assets
├── package.json            # Frontend scripts and dependencies
├── README.md               # Project start instructions
├── ev-finder-overview.md   # Project summary
└── vite.config.ts          # Vite configuration
```

---

## Current app focus

The current product is focused on the discovery layer:

- listing stations
- filtering stations by connector and power
- searching by city, area, and station name
- map location visualization
- displaying station status and key charging details

This is the core value of the project, and it should stay the primary product scope unless business requirements expand into bookings, routes, or user accounts beyond the MVP stage.

---

## API implementation plan

### 1. Define the API foundation

- Use versioned endpoints: `/api/v1/...`
- Standardize response format:
  - success: `true|false`
  - `data` for successful payloads
  - `error` message for failures
- Add validation and consistent HTTP status codes
- Use JWT for protected routes and optional auth for public routes that can personalize experience

### 2. Public station endpoints

Implement the discovery layer first:

- `GET /api/v1/stations` — list stations with pagination, city filter, network filter, connector filter
- `GET /api/v1/stations/:id` — get full station details
- `GET /api/v1/stations/search` — search by station name, city, address, pincode
- `GET /api/v1/stations/cities` — list available cities
- `GET /api/v1/stations/nearby` — location-based search using lat/lng and radius
- `GET /api/v1/stations/bounds` — map viewport query for visible markers

### 3. Auth and user flows

Add the login and account layer next:

- `POST /api/v1/auth/otp/send`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/user/profile`
- `PUT /api/v1/user/profile`

### 4. Personalization features

Once auth is stable, add user-specific features:

- `GET /api/v1/user/vehicles`
- `POST /api/v1/user/vehicles`
- `DELETE /api/v1/user/vehicles/:vehicleId`
- `GET /api/v1/user/favorites`
- `POST /api/v1/user/favorites/:stationId`
- `DELETE /api/v1/user/favorites/:stationId`

### 5. Booking and review system

These are useful but should be built after the station discovery flow is stable:

- `POST /api/v1/stations/:id/reserve`
- `GET /api/v1/bookings/my`
- `PATCH /api/v1/bookings/:bookingId/cancel`
- `GET /api/v1/stations/:id/reviews`
- `POST /api/v1/stations/:id/reviews`

### 6. Data layer and storage

- Use a single source of truth for station records
- Keep a `stations` table with fields for id, name, city, state, lat, lng, status, connectors, power, pricing, and address
- Add a user table and optional booking/review tables
- Keep the current in-memory fallback for local development and demo mode

### 7. Performance and reliability

- Add pagination and filtering at the database query layer
- Use index on city, state, lat, lng, network, status
- Optimize geospatial queries for nearby stations and map bounds
- Add structured logging and environment-based config
- Add retry and graceful fallback behavior for missing database connectivity

### 8. Recommended implementation order

1. Station listing and search
2. Station detail endpoint
3. Nearby and bounds endpoints
4. OTP auth and JWT middleware
5. User favorites and vehicles
6. Reviews and reservations
7. Monitoring, DB integration, and production hardening

---

## Recommended direction

The project should keep its scope focused on EV charging station discovery, user convenience, and map-driven usability. Avoid expanding into unrelated features before the core station data and discovery experience are stable.

The modern Node.js backend should become the product’s main API layer, while the legacy PHP/MySQL artifacts remain as a compatibility or migration reference rather than the primary implementation path.

For endpoint details and example payloads, see [backend/API_CONTRACT.md](backend/API_CONTRACT.md).
