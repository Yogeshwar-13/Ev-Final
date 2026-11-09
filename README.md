# India EV Map

build me a forntend for an website which lists and shows all the EV charging stations across India

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/036be06f-72fd-4cdf-8e83-bdc3f9f6fceb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Requires Node.js, npm, and MySQL 5.7+ (XAMPP is suitable locally).

```sh
npm install
npm run db:generate
```

Import `backend/schema.sql` into MySQL (it creates the reviews table, upserts stations, and can be rerun), then copy `.env.example` to `.env` and set the local MySQL credentials. Start the API and web app in separate terminals:

```sh
npm run api:dev
npm run dev
```

The Node API reads station records from `ev_stations`; it does not silently substitute the bundled dataset when the database is unavailable. The health endpoint reports the database connection and station count at `/api/v1/health`.

### Vercel deployment

The production build uses Nitro's Vercel preset to deploy the TanStack Start server-rendered app. Keep the Vercel project root set to this directory (the one containing `package.json` and `vercel.json`); the build command is `npm run build`. Do not configure a static output directory or an SPA rewrite, as those bypass the server-rendered routes and API function.

The REST API is handled by TanStack Start server routes and shares the same Vercel server function. Before deployment:

1. Provision a managed MySQL database that is reachable from Vercel.
2. Import `backend/schema.sql` into it, including the station data.
3. Add `DATABASE_URL` in the Vercel project's Production environment variables. Use a `mysql://` or `mysqls://` URL and never use `localhost`.
4. Set `DB_SSL=true` if the database provider requires TLS. Set `DB_CONNECTION_LIMIT=2` (or the limit recommended by the provider) to keep serverless connections within the database plan's limits.
5. Deploy, then check `/api/v1/health`; it should return `"database":"connected"` and the expected station count.

The database URL is intentionally not committed to the repository. Preview and Development deployments need their own database environment values if they should serve live data.

No login, user accounts, favorites, or booking features are included. Station reviews are public and stored in MySQL without user accounts. The API does not require authentication.
