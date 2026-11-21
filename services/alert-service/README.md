# 10. Alert & Geofence Service

Alert rules (GPS offline, overspeed), circular geofences, and the alerts created from GPS / geofence / job events.

| | |
| --- | --- |
| Database | `alert_db` (role `alert_svc`), Prisma schema in `prisma/schema.prisma` |
| Owns tables | `alert_rules`, `geofences`, `alerts` |
| Gateway prefix | see `gateway/src/index.ts` |

## Public endpoints (from the project PDF, pages 18-26)

- [ ] `GET /api/v1/alert-rules`
- [ ] `POST /api/v1/alert-rules`
- [ ] `PUT /api/v1/alert-rules/:id`
- [ ] `PATCH /api/v1/alert-rules/:id/status`
- [ ] `GET /api/v1/geofences`
- [ ] `POST /api/v1/geofences`
- [ ] `PUT /api/v1/geofences/:id`
- [ ] `PATCH /api/v1/geofences/:id/status`
- [ ] `DELETE /api/v1/geofences/:id`
- [ ] `GET /api/v1/alerts`
- [ ] `GET /api/v1/alerts/:id`
- [ ] `PATCH /api/v1/alerts/:id/read`
- [ ] `PATCH /api/v1/alerts/:id/handling`
- [ ] `PATCH /api/v1/alerts/:id/resolve`

Only the read-only `/internal` API for reporting-service exists so far; none of the public endpoints below.

Every endpoint must check Authentication, Role and `company_id` from the signed-in user, never from the request body (PDF page 18).

## Internal API other services call (not routed by the gateway, needs `x-internal-token`)

- `GET /internal/stats/alerts?company_id=&from=&to=` alerts triggered in the window by type and status, how many are open, average time to resolve (for reporting-service)
- `GET /internal/alerts?company_id=&from=&to=&type=&status=&limit=&offset=` one page of a company's alerts (for reporting-service)

## Data it needs from other services (ask them over `/internal/*`, never their database)

- gps-data-service (positions, for geofence and offline checks)
- vehicle-service, transport-service, user-service
- auth-service

## Data layer

- Edit `prisma/schema.prisma`, then create a migration: `DATABASE_URL=... bunx prisma migrate dev --name what_changed` (see `docs/DATABASE.md`).
- Fields keep the Data Dictionary names (snake_case). BIGINT ids are strings in the API.
- Other services' ids (`company_id`, `vehicle_id`, ...) are plain columns without foreign keys.

## Code layout

`src/app.ts` builds the app, `src/config/env.ts` reads env, `src/plugins/guard.ts` gives `authed(...roles)` for protected routes. `src/lib/prisma.ts` is the database client.
Keep routes thin; put rules in a service / use-case file and every database call in a repository file (see `docs/PROJECT_STRUCTURE.md`).
