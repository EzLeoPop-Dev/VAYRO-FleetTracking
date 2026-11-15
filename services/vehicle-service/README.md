# 4. Vehicle Service

Vehicles, vehicle types, vehicle status and the driver assigned to a vehicle.

| | |
| --- | --- |
| Database | `vehicle_db` (role `vehicle_svc`), Prisma schema in `prisma/schema.prisma` |
| Owns tables | `vehicle_types`, `vehicles` |
| Gateway prefix | see `gateway/src/index.ts` |

## Public endpoints (from the project PDF, pages 18-26)

- [ ] `GET /api/v1/vehicles`
- [ ] `GET /api/v1/vehicles/:id`
- [ ] `POST /api/v1/vehicles`
- [ ] `PUT /api/v1/vehicles/:id`
- [ ] `DELETE /api/v1/vehicles/:id`
- [ ] `PATCH /api/v1/vehicles/:id/driver`
- [ ] `PATCH /api/v1/vehicles/:id/status`
- [ ] `GET /api/v1/vehicle-types`
- [ ] `POST /api/v1/vehicle-types`
- [ ] `PUT /api/v1/vehicle-types/:id`
- [ ] `DELETE /api/v1/vehicle-types/:id`

Every endpoint must check Authentication, Role and `company_id` from the signed-in user, never from the request body (PDF page 18).

## Internal API other services call (not routed by the gateway, needs `x-internal-token`)

- `GET /internal/vehicles/:id?company_id=` returns `{vehicle_id, company_id, vehicle_status, current_driver_id}` (404 if not in that company)

## Data it needs from other services (ask them over `/internal/*`, never their database)

- auth-service (caller identity)
- user-service (is the driver in the same company) - not wired yet

## Data layer

- Edit `prisma/schema.prisma`, then create a migration: `DATABASE_URL=... bunx prisma migrate dev --name what_changed` (see `docs/DATABASE.md`).
- Fields keep the Data Dictionary names (snake_case). BIGINT ids are strings in the API.
- Other services' ids (`company_id`, `vehicle_id`, ...) are plain columns without foreign keys.

## Code layout

`src/app.ts` builds the app, `src/config/env.ts` reads env, `src/plugins/guard.ts` gives `authed(...roles)` for protected routes. `src/lib/prisma.ts` is the database client.
Keep routes thin; put rules in a service / use-case file and every database call in a repository file (see `docs/PROJECT_STRUCTURE.md`).
