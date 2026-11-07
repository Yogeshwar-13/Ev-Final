# EV Finder API Contract

Base URL: `http://localhost:5000/api/v1` locally, or `https://<your-domain>/api/v1` on Vercel.

The API is public and does not use authentication. Station data and reviews are stored in MySQL. Generate/import the current station dataset with `npm run db:generate` and `backend/schema.sql`. Configure `DATABASE_URL` on Vercel, or `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` locally.

## Station discovery

- `GET /stations?page=1&limit=20&city=Bengaluru&network=all&connector=CCS2&min_power_kw=30&status=available&q=`
- `GET /stations/:id`
- `GET /stations/cities`
- `GET /stations/search?q=indiranagar&city=bengaluru&limit=10`
- `GET /stations/nearby?lat=12.97&lng=77.59&radius_km=10&limit=20`
- `GET /stations/bounds?min_lat=12.9&max_lat=13.1&min_lng=77.5&max_lng=77.8&limit=50`

List responses contain `success`, `count`, and `data`; `/stations` also includes pagination metadata. Database failures return an error response.

## Reviews

- `GET /stations/:id/reviews` returns saved reviews.
- `POST /stations/:id/reviews` adds a public review to the database.

Request body:

```json
{
  "userName": "EV Driver",
  "rating": 5,
  "comment": "Fast and clean setup.",
  "plugCondition": "working_perfect"
}
```

`rating` must be an integer from 1 to 5. `plugCondition` can be `working_perfect`, `slow_charge`, or `broken_connector`. The optional reviewer name defaults to `EV Driver`.

## Route planner and health

- `POST /routes/plan` accepts origin/destination coordinates and optional vehicle range details; it suggests a station stop if needed.
- `GET /health` reports database connectivity and station row count.

Login, account/profile, vehicles, favorites, and booking endpoints are not part of this API.
