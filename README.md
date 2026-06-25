# Upaadhi

Upaadhi is a hyperlocal earning marketplace for jobs, services, selling, and renting.

This repository starts with a day-one microservices layout:

- `apps/api-gateway`: public API gateway and mobile BFF.
- `apps/identity-service`: OTP/auth and user identity foundation.
- `apps/listing-service`: listing lifecycle and category metadata.
- `apps/feed-service`: unified feed and search projection.
- `apps/trust-service`: report, moderation, and trust actions.
- `apps/web`: light-theme React client for the first product shell.
- `packages/shared`: shared contracts, response helpers, seed data, and types.

## Local Development

Install dependencies:

```bash
npm install
```

Optional: copy environment defaults:

```bash
copy .env.example .env
```

Run the API services and web client:

```bash
npm run dev
```

Default URLs:

- Web: `http://localhost:5173`
- API Gateway: `http://localhost:4000`
- Identity Service: `http://localhost:4101`
- Listing Service: `http://localhost:4102`
- Feed Service: `http://localhost:4103`
- Trust Service: `http://localhost:4104`

## Local Feature Test Flow

1. Open `http://localhost:5173`.
2. Use the prefilled phone number `+919876543210`.
3. Click `Request OTP`.
4. The local development OTP appears on screen.
5. Click `Verify and login`.
6. After login, verify:
   - Feed loads nearby listings.
   - Category chips filter the feed.
   - `Call` and `Chat` buttons update the action status.
   - `Report listing` creates a report.
   - `Post quick job` creates a `pending_review` listing.
   - `Approve and show in feed` approves it and reloads the feed.

You can also run the automated flow:

```bash
npm run test:smoke
```

## Architecture Note

The first build uses separate Node/Fastify services with repository interfaces. When `DATABASE_URL` is set, identity, listing, and trust services use PostgreSQL. When it is unset, they use in-memory repositories for local development.

## PostgreSQL Setup

If Docker is available:

```bash
docker compose -f infra/docker-compose.yml up -d
npm run migrate
```

If Docker is not available, install PostgreSQL manually, create a database, set `DATABASE_URL`, then run:

```bash
npm run migrate
```

The migrations create service-owned schemas:

- `identity`
- `listing`
- `trust`
- `platform`

Production/staging must set `DATABASE_URL`; the in-memory fallback is for local development only.
