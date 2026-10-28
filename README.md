# NCRTC Bus Management System — Full-Stack Student Assignment

A runnable full-stack prototype based on the supplied NCRTC Bus Management System brief. It uses **React + Vite**, **Node.js + Express**, and **PostgreSQL + PostGIS**. Bus positions are simulated seed data; no live GPS hardware is connected.

## Implemented modules

- **Shared authentication and roles:** JWT login, bcrypt password hashes, roles `admin`, `driver`, `conductor`, `depot_manager`, `control_operator`, protected API routes and role checks.
- **AVLS:** Leaflet/OpenStreetMap map, 50 seeded vehicles, current position/status data and GPS ping history table.
- **Scheduling:** route/vehicle/driver duty assignments, roster list, publish and driver acknowledgement status transitions.
- **Incident Management:** P1/P2/P3 severity, incident creation, status lifecycle, event timeline records.
- **Communications/CMS:** notices, audience targeting, draft/publish flow, read receipts.
- **Fleet and route administration:** vehicle status updates, route creation, staff directory for authorized roles.
- **Assumptions and architecture decisions:** `docs/ASSUMPTIONS_AND_ARCHITECTURE.md`.

## Requirements

- Node.js 20 or later and npm
- Docker Desktop (to run the included PostgreSQL/PostGIS database)

## Run locally

1. Extract the project and open the root folder in VS Code.
2. Start the database from the project root:

   ```bash
   docker compose up -d db
   ```

   The first startup creates the schema. If you changed the schema after the database volume was already initialized, reset the local demo database with `docker compose down -v` and then `docker compose up -d db`. This deletes the local demo database volume.

3. Install dependencies:

   ```bash
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```

4. Configure backend environment:

   ```bash
   cp backend/.env.example backend/.env
   ```

   Windows PowerShell alternative: `Copy-Item backend/.env.example backend/.env`. The defaults are for local development only.

5. Seed the demo data:

   ```bash
   npm run seed --prefix backend
   ```

6. Start the API and frontend in separate terminals (or run `npm run dev` from the root after installing root dependencies):

   ```bash
   npm run dev --prefix backend
   npm run dev --prefix frontend
   ```

7. Open **http://localhost:5173**. API health check: **http://localhost:4000/api/health**.

## Demo accounts

All seeded accounts use password `Demo@12345`:

| Role | Email |
|---|---|
| Admin | `admin@ncrtc.demo` |
| Driver | `driver@ncrtc.demo` |
| Depot Manager | `manager@ncrtc.demo` |
| Control Operator | `control@ncrtc.demo` |
| Conductor | `conductor@ncrtc.demo` |

These are public demo credentials, not real accounts. Never deploy this configuration or secret to production.

## Useful commands

```bash
npm run build                 # build frontend
npm run dev --prefix backend  # API on :4000
npm run dev --prefix frontend # Vite on :5173
npm run seed --prefix backend # insert demo records
```

## API overview

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/register` (admin only)
- `GET /api/dashboard`
- `GET /api/vehicles`, `PATCH /api/vehicles/:id/status`
- `GET/POST /api/routes`
- `GET/POST /api/duties`, `PATCH /api/duties/:id/status`
- `GET/POST /api/incidents`, `PATCH /api/incidents/:id/status`, `GET /api/incidents/:id/events`
- `GET/POST /api/notices`, `PATCH /api/notices/:id/status`, `POST /api/notices/:id/read`
- `GET /api/users` (admin/depot manager)

All `/api/*` endpoints other than health and login require a bearer token. Validation and role restrictions are implemented on the server, not just hidden in the UI.

## Before submitting

- Run `npm run build` in the root.
- Test the health endpoint, each demo login, and each main module.
- Review `docs/ASSUMPTIONS_AND_ARCHITECTURE.md` and adjust it to decisions you can explain.
- Replace local development secrets before any hosted deployment. Do not claim live GPS integration; locations are simulated.
- Commit the source and documentation to a GitHub repository you own and share that repository URL with the recruiter.

## Known prototype limitations

- GPS updates are simulated seed pings, not real-time hardware feeds; no background simulator or WebSocket stream is included yet.
- Route stops can be seeded in the schema, but a full route-stop editor is not included in this UI.
- Automated integration tests, full audit logging, password reset, and production deployment configuration remain future improvements.
- This is an assignment prototype and should not be used for live transport operations without security review, testing, monitoring and operational approval.
