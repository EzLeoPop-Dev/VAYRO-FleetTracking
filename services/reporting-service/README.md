# 11. Reporting & Dashboard Service

Dashboards and reports per role and workspace. Stores nothing of its own; collects numbers from the other services.

| | |
| --- | --- |
| Database | none (stateless) |
| Owns tables | - |
| Gateway prefix | see `gateway/src/index.ts` |

## Public endpoints (from the project PDF, pages 18-26)

- [ ] `GET /api/v1/dashboard/platform`
- [ ] `GET /api/v1/dashboard/company`
- [ ] `GET /api/v1/reports/vehicles`
- [ ] `GET /api/v1/reports/routes`
- [ ] `GET /api/v1/reports/jobs`
- [ ] `GET /api/v1/reports/alerts`
- [ ] `GET /api/v1/reports/gps`

Every endpoint must check Authentication, Role and `company_id` from the signed-in user, never from the request body (PDF page 18).

## Data it needs from other services (ask them over `/internal/*`, never their database)

- company-service, user-service, vehicle-service, gps-device-service, gps-data-service, transport-service, alert-service
- auth-service

## Code layout

`src/app.ts` builds the app, `src/config/env.ts` reads env, `src/plugins/guard.ts` gives `authed(...roles)` for protected routes.
Keep routes thin; put rules in a service / use-case file and every database call in a repository file (see `docs/PROJECT_STRUCTURE.md`).
