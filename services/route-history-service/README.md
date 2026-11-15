# 8. Route History Service

Route history of a vehicle over a time range: points, route and an approximate distance. Stores nothing of its own; reads gps-data-service and vehicle-service.

| | |
| --- | --- |
| Database | none (stateless) |
| Owns tables | - |
| Gateway prefix | see `gateway/src/index.ts` |

## Public endpoints (from the project PDF, pages 18-26)

- [ ] `GET /api/v1/routes/vehicles/:id`
- [ ] `GET /api/v1/routes/vehicles/:id/points`
- [ ] `GET /api/v1/routes/vehicles/:id/summary`

Every endpoint must check Authentication, Role and `company_id` from the signed-in user, never from the request body (PDF page 18).

## Data it needs from other services (ask them over `/internal/*`, never their database)

- gps-data-service (stored points)
- vehicle-service (vehicle belongs to the company)
- auth-service

## Code layout

`src/app.ts` builds the app, `src/config/env.ts` reads env, `src/plugins/guard.ts` gives `authed(...roles)` for protected routes.
Keep routes thin; put rules in a service / use-case file and every database call in a repository file (see `docs/PROJECT_STRUCTURE.md`).
