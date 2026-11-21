# 9. Transport Job Service

Transport jobs: create, assign vehicle and driver, start, complete, report a problem, cancel.

| | |
| --- | --- |
| Database | `transport_db` (role `transport_svc`), Prisma schema in `prisma/schema.prisma` |
| Owns tables | `transport_jobs`, `system_log` |
| Gateway prefix | see `gateway/src/index.ts` |

## Public endpoints (from the project PDF, pages 18-26)

| Method | Path | Who | What |
| --- | --- | --- | --- |
| [x] GET | `/api/v1/jobs` | Company Admin, Dispatcher | List with filters `status`, `vehicle_id`, `driver_id`, `search` (job_code / job_name), `scheduled_from`, `scheduled_to`, `limit`, `offset` |
| [x] GET | `/api/v1/jobs/:id` | Company Admin, Dispatcher, Driver (own job only) | One job |
| [x] POST | `/api/v1/jobs` | Company Admin, Dispatcher | Create. `vehicle_id` and `driver_id` may be given together to create it already `assigned` |
| [x] PUT | `/api/v1/jobs/:id` | Company Admin, Dispatcher | Edit details, addresses, coordinates, schedule (not `job_code`, vehicle or driver) |
| [x] PATCH | `/api/v1/jobs/:id/assign` | Company Admin, Dispatcher | Body `{vehicle_id, driver_id}` |
| [x] PATCH | `/api/v1/jobs/:id/start` | Company Admin, Dispatcher, Driver (own job) | Sets `in_progress` and `actual_start_at` |
| [x] PATCH | `/api/v1/jobs/:id/complete` | Company Admin, Dispatcher, Driver (own job) | Sets `completed` and `actual_end_at` |
| [x] PATCH | `/api/v1/jobs/:id/problem` | Company Admin, Dispatcher, Driver (own job) | Body `{problem_note}` |
| [x] PATCH | `/api/v1/jobs/:id/cancel` | Company Admin, Dispatcher | Optional body `{reason}` |
| [x] GET | `/api/v1/driver/jobs` | Driver | The signed-in driver's own jobs (`status`, `limit`, `offset`) |

`company_id` and `created_by` always come from the signed-in user; bodies that contain unknown fields are refused (422).

## Rules

- Status flow: `pending -> assigned -> in_progress -> completed`; `problem` and `cancelled` can happen while the job is open. `completed` and `cancelled` are final. See `src/modules/jobs/jobs.rules.ts`.
  - `assign`: from `pending`, `assigned`, `problem`. `start`: from `assigned` or `problem` (resumes). `complete` and `problem`: from `in_progress`. `cancel`: from any open status. `edit`: any open status.
- The vehicle must exist in the caller's company and be `active`; the driver must be an `active` user with role `driver` in the same company (checked through vehicle-service and user-service).
- A driver and a vehicle can each have only one `in_progress` job. Starting is serialized per driver and per vehicle with advisory locks, so two requests cannot both win (409 `DRIVER_BUSY` / `VEHICLE_BUSY`).
- `assign`, `create` (when assigned) and `start` answer with `warnings: ["vehicle_current_driver_differs"]` when the vehicle's `current_driver_id` is not the job's driver. gps-data-service accepts a driver's phone positions only for the vehicle whose `current_driver_id` is that driver, so the app would be refused until vehicle-service is updated.
- Every create / update / assign / start / complete / problem / cancel writes one `system_log` row in the same transaction.
- Alerts (best effort, never block the request): assigning raises a `job_assignment` alert for the driver; a reported problem raises a `system_anomaly` alert (`event_data.reason = "job_problem"`); when a running job ends, alert-service is told to pause its "GPS offline" check for that vehicle. Needs `ALERT_SERVICE_URL`; without it jobs work as before.

## Internal API other services call (not routed by the gateway, needs `x-internal-token`)

- `GET /internal/jobs/in-progress?company_id=&vehicle_id=&driver_id=` returns `{exists}` (gps-data-service)
- `GET /internal/jobs/driver-windows?company_id=&driver_id=&vehicle_id=&from=&to=` returns `[{job_id, started_at, ended_at|null}]`, newest first, at most 50 (route-history-service shows a driver only these stretches)
- `GET /internal/system-logs` this service's audit rows (integration-service)
- `GET /internal/stats/jobs?company_id=&from=&to=` jobs created in the window by status plus average duration of completed ones (for reporting-service)
- `GET /internal/jobs?company_id=&from=&to=&status=&limit=&offset=` one page of a company's jobs (for reporting-service)

## Data it needs from other services (over `/internal/*`, never their database)

- vehicle-service (`/internal/vehicles/:id`), user-service (`/internal/users/:id`), auth-service (caller identity), alert-service (optional)

## Tests

`bun test` runs `test/jobs.rules.test.ts` (state machine, input rules, lock order). The HTTP and database paths are exercised through Postman (see `docs/postman/`).

## Data layer

- Edit `prisma/schema.prisma`, then create a migration: `DATABASE_URL=... bunx prisma migrate dev --name what_changed` (see `docs/DATABASE.md`).
- Fields keep the Data Dictionary names (snake_case). BIGINT ids are strings in the API.
- Other services' ids (`company_id`, `vehicle_id`, ...) are plain columns without foreign keys.

## Code layout

`src/app.ts` builds the app, `src/config/env.ts` reads env, `src/plugins/guard.ts` gives `authed(...roles)`, `src/lib/prisma.ts` is the database client, `src/adapters/` talks to other services, `src/modules/jobs/` holds model, repository, rules (pure), service and routes.
