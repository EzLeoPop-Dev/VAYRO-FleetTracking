import { http, idSchema, internalGuard, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { config } from "../../config/env";
import { authenticate, revokeUserSessions } from "../auth/auth.service";

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  // Other services forward the caller's bearer token here instead of holding the JWT secret or session data.
  .get("/introspect", async ({ headers }) => ok(await authenticate(headers.authorization)))
  .post("/sessions/revoke", async ({ body }) => ok({ revoked: await revokeUserSessions(body.user_id) }), { body: t.Object({ user_id: idSchema }) });
