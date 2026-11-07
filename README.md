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

Vercel serves the API through the included `api/[...path].ts` serverless function. Configure `DATABASE_URL` in the Vercel project settings to point to a network-accessible managed MySQL database containing `ev_stations`, and set `DB_SSL=true` when the provider requires TLS. Do not use `localhost` for the Vercel database host. Import the generated `backend/schema.sql` into that database before deployment. `DB_CONNECTION_LIMIT` can be lowered (for example, to `2`) for serverless database connection limits.

No login, user accounts, favorites, or booking features are included. Station reviews are public and stored in MySQL without user accounts. The API does not require authentication.
