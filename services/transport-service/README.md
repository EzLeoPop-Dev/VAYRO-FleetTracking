# 9. Transport Job Service

Transport jobs: create, assign vehicle and driver, start, complete, report a problem, cancel.

| | |
| --- | --- |
| Database | `transport_db` (role `transport_svc`), Prisma schema in `prisma/schema.prisma` |
| Owns tables | `transport_jobs` |
| Gateway prefix | see `gateway/src/index.ts` |

## Public endpoints (from the project PDF, pages 18-26)

- [ ] `GET /api/v1/jobs`
- [ ] `GET /api/v1/jobs/:id`
- [ ] `POST /api/v1/jobs`
- [ ] `PUT /api/v1/jobs/:id`
- [ ] `PATCH /api/v1/jobs/:id/assign`
- [ ] `PATCH /api/v1/jobs/:id/start`
- [ ] `PATCH /api/v1/jobs/:id/complete`
- [ ] `PATCH /api/v1/jobs/:id/problem`
- [ ] `PATCH /api/v1/jobs/:id/cancel`
- [ ] `GET /api/v1/driver/jobs`

Every endpoint must check Authentication, Role and `company_id` from the signed-in user, never from the request body (PDF page 18).

## Internal API other services call (not routed by the gateway, needs `x-internal-token`)

- `GET /internal/jobs/in-progress?company_id=&vehicle_id=&driver_id=` returns `{exists}`
- `GET /internal/stats/jobs?company_id=&from=&to=` jobs created in the window by status plus average duration of completed ones (for reporting-service)
- `GET /internal/jobs?company_id=&from=&to=&status=&limit=&offset=` one page of a company's jobs (for reporting-service)

## Data it needs from other services (ask them over `/internal/*`, never their database)

- vehicle-service, user-service (vehicle and driver are in the same company)
- auth-service (caller identity)

## Data layer

- Edit `prisma/schema.prisma`, then create a migration: `DATABASE_URL=... bunx prisma migrate dev --name what_changed` (see `docs/DATABASE.md`).
- Fields keep the Data Dictionary names (snake_case). BIGINT ids are strings in the API.
- Other services' ids (`company_id`, `vehicle_id`, ...) are plain columns without foreign keys.

## Code layout

`src/app.ts` builds the app, `src/config/env.ts` reads env, `src/plugins/guard.ts` gives `authed(...roles)` for protected routes. `src/lib/prisma.ts` is the database client.
Keep routes thin; put rules in a service / use-case file and every database call in a repository file (see `docs/PROJECT_STRUCTURE.md`).
