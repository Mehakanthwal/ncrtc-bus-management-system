# Assumptions and Key Architectural Decisions

## 1. Scope and assumptions

1. The system is an academic/recruitment prototype based on the supplied NCRTC Bus Management System brief. It does not connect to actual NCRTC systems, production accounts, or GPS hardware.
2. Vehicle positions and GPS pings are simulated seed data. The map displays the latest stored coordinates, and the GPS history table is ready for future playback/history APIs.
3. One API service and one relational database are sufficient for the expected assignment scope; microservices and a message broker are intentionally avoided.
4. The system has five roles: `admin`, `driver`, `conductor`, `depot_manager`, and `control_operator`. Access is enforced by backend middleware. UI hiding is convenience only, not the security boundary.
5. A duty has one route, one vehicle, one driver, a date, start/end times, and a lifecycle status. The prototype does not yet validate overlapping assignments or vehicle/driver availability conflicts.
6. Incident status transitions follow Open → Acknowledged → In Progress → Resolved → Closed. Severity is P1, P2, or P3. Each change adds an incident event.
7. Notices can target all staff or one of the supported staff audiences. Marking a notice read records a unique `(notice_id, user_id)` receipt.
8. The supplied brief is described as containing eleven tables, but the listed entities are implemented as twelve tables: users, vehicles, stops, routes, route_stops, duties, gps_pings, incidents, incident_events, notices, notice_reads, plus PostgreSQL's extension metadata is not an application table.
9. Seeded credentials are public demo-only credentials and must not be used for real users.

## 2. Technology decisions

- **Frontend:** React + Vite. Component-based UI, fast local development and straightforward production build.
- **Mapping:** Leaflet + OpenStreetMap. No paid map API key is required for the demo. Tile usage should follow OpenStreetMap tile policy.
- **Backend:** Node.js + Express REST API. This matches the JavaScript frontend ecosystem and keeps the assignment to one small API service.
- **Database:** PostgreSQL with PostGIS. PostgreSQL provides relational integrity and transactions; PostGIS `geography(Point,4326)` stores geographic GPS pings and can support spatial queries later.
- **Authentication:** bcrypt password hashing and signed JWT bearer tokens. API middleware validates tokens and checks roles. The development JWT secret must be changed before deployment.
- **Data access:** parameterized SQL through `pg`; no ORM is required for this compact project. Schema is versioned as SQL.
- **Local environment:** Docker Compose provides a repeatable PostgreSQL/PostGIS database. Frontend and API run as separate Node processes in development.
- **Data refresh:** the UI uses explicit refresh/load requests and standard REST calls. Polling/WebSockets can be added later if a live tracking requirement needs them.

## 3. High-level architecture

```text
Browser (React + Vite :5173)
    | HTTPS in deployment / HTTP locally, JWT bearer token
    v
Express REST API (:4000)
    | validation + authentication + role authorization
    v
PostgreSQL + PostGIS (:5432)
    | users, vehicles, routes, stops, duties, GPS pings,
    | incidents/events, notices/read receipts
```

The frontend never connects directly to PostgreSQL. Database credentials remain on the server. The API returns JSON and applies role rules to protected operations.

## 4. Main data entities

- `users`: account identity, password hash, role, depot and active flag.
- `vehicles`: fleet identifier, registration, route/driver assignment, status and latest coordinates.
- `routes`, `stops`, `route_stops`: route metadata and ordered stop relationship.
- `duties`: date/shift assignments linking route, vehicle and driver.
- `gps_pings`: time-series location points using PostGIS geography and a vehicle/time index.
- `incidents`, `incident_events`: incident record and chronological status/note timeline.
- `notices`, `notice_reads`: audience-targeted announcements and one read receipt per user/notice.

## 5. Security decisions

- Passwords are stored as bcrypt hashes, never plaintext.
- JWTs have an expiry and protected endpoints reject missing, invalid or expired tokens.
- Mutating operations check the user's role server-side.
- SQL statements use positional parameters to avoid concatenating user input into SQL.
- Helmet, CORS allow-listing and a login rate limit are enabled.
- Production deployment must use HTTPS, a strong secret manager value, restricted database networking, backups, logging, monitoring, CSRF-aware cookie/token handling as appropriate, and a security review.

## 6. Known trade-offs and next steps

1. Add automated tests for authentication, permissions, status transitions and CRUD endpoints.
2. Add overlap checks to prevent assigning the same vehicle or driver to conflicting duties.
3. Add route-stop editing and endpoint to query GPS history over a time range.
4. Add a background simulator that appends a ping every 5–10 seconds and updates the latest vehicle position; consider WebSockets only if polling is insufficient.
5. Add pagination, server-side search, richer validation, structured logging, and consistent API error handling.
6. Add integration tests and a deployment profile before using anything beyond a local demo.

## 7. Demo validation checklist

- Log in as each seeded role and verify role-based UI/API behavior.
- Confirm the dashboard counts match seeded database records.
- Open the tracking page and verify vehicle pins render from API data.
- Create a duty, publish it as a manager, then acknowledge it as the driver.
- Create an incident, move it through status changes, and verify timeline events in the database.
- Create a notice, publish it, and mark it read; verify the read receipt row.
- Stop the API and confirm the frontend displays a useful connection error.
