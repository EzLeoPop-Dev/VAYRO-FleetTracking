# 2. Company Service

Company workspaces: registration request, Platform Admin approval / rejection / suspension.

| | |
| --- | --- |
| Database | `company_db` (role `company_svc`), Prisma schema in `prisma/schema.prisma` |
| Owns tables | `company` |
| Gateway prefix | see `gateway/src/index.ts` |

## Public endpoints (from the project PDF, pages 18-26)

- [x] `POST /api/v1/companies/register`
- [ ] `GET /api/v1/companies`
- [ ] `GET /api/v1/companies/:id`
- [ ] `PUT /api/v1/companies/:id`
- [ ] `PATCH /api/v1/companies/:id/approve`
- [ ] `PATCH /api/v1/companies/:id/reject`
- [ ] `PATCH /api/v1/companies/:id/status`

Every endpoint must check Authentication, Role and `company_id` from the signed-in user, never from the request body (PDF page 18).

## Internal API other services call (not routed by the gateway, needs `x-internal-token`)

- `GET /internal/companies/:id` returns `{company_id, workspace_status}`

## Data it needs from other services (ask them over `/internal/*`, never their database)

- user-service (create the first Company Admin), auth-service (caller identity)

## Data layer

- Edit `prisma/schema.prisma`, then create a migration: `DATABASE_URL=... bunx prisma migrate dev --name what_changed` (see `docs/DATABASE.md`).
- Fields keep the Data Dictionary names (snake_case). BIGINT ids are strings in the API.
- Other services' ids (`company_id`, `vehicle_id`, ...) are plain columns without foreign keys.

## Code layout

`src/app.ts` builds the app, `src/config/env.ts` reads env, `src/plugins/guard.ts` gives `authed(...roles)` for protected routes. `src/lib/prisma.ts` is the database client.
Keep routes thin; put rules in a service / use-case file and every database call in a repository file (see `docs/PROJECT_STRUCTURE.md`).
