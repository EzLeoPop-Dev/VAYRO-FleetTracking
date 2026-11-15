# 12. Integration & Logging Service

API keys for external clients (create, rotate, revoke, permissions, rate limit), the API request log, and the system log view.

| | |
| --- | --- |
| Database | `integration_db` (role `integration_svc`), Prisma schema in `prisma/schema.prisma` |
| Owns tables | `api_integrations`, `api_request_logs`, `system_log` |
| Gateway prefix | see `gateway/src/index.ts` |

## Public endpoints (from the project PDF, pages 18-26)

- [ ] `GET /api/v1/integrations`
- [ ] `POST /api/v1/integrations`
- [ ] `GET /api/v1/integrations/:id`
- [ ] `PUT /api/v1/integrations/:id`
- [ ] `POST /api/v1/integrations/:id/rotate-key`
- [ ] `PATCH /api/v1/integrations/:id/revoke`
- [ ] `GET /api/v1/integration-logs`
- [ ] `GET /api/v1/system-logs`

Every endpoint must check Authentication, Role and `company_id` from the signed-in user, never from the request body (PDF page 18).

## Data it needs from other services (ask them over `/internal/*`, never their database)

- auth-service (caller identity, API-key checks for external clients)
- company-service

## Data layer

- Edit `prisma/schema.prisma`, then create a migration: `DATABASE_URL=... bunx prisma migrate dev --name what_changed` (see `docs/DATABASE.md`).
- Fields keep the Data Dictionary names (snake_case). BIGINT ids are strings in the API.
- Other services' ids (`company_id`, `vehicle_id`, ...) are plain columns without foreign keys.

## Code layout

`src/app.ts` builds the app, `src/config/env.ts` reads env, `src/plugins/guard.ts` gives `authed(...roles)` for protected routes. `src/lib/prisma.ts` is the database client.
Keep routes thin; put rules in a service / use-case file and every database call in a repository file (see `docs/PROJECT_STRUCTURE.md`).
