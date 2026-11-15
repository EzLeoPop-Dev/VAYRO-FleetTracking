# Authentication Service

Elysia + Bun backend for `/api/v1/auth/login`, `/logout`, `/refresh` (POST) and `/me` (GET).
Owns `auth_sessions` and its own `system_log` in `auth_db` (Prisma). Users belong to `services/user-service` and companies to `services/company-service`: login asks user-service to check the password and company-service for the workspace status, and other services call `GET /internal/introspect` to validate a bearer token.

From the repository root:

```sh
docker compose up --build -d --wait postgres auth-service user-service gateway
docker compose exec -T auth-service bun test test/security.test.ts
node services/auth-service/test/e2e.mjs
```

Use a local development database for E2E tests (they create and retain test accounts).
See [the authentication guide](../../docs/AUTH.md) for payloads, dictionary mapping, session policies and known limits.
Local Bun development requires `DATABASE_URL` (auth_db), `JWT_SECRET` (at least 32 characters), `USER_SERVICE_URL`, `COMPANY_SERVICE_URL`, `INTERNAL_API_TOKEN` (at least 32 characters) and `PORT=3002`, plus `bun run db:generate`, before `bun run dev:auth` at the root.
