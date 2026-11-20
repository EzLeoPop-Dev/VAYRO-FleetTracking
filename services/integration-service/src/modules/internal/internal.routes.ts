import { http, internalGuard, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { verifyApiKey } from "../../application/verify-key";
import { config } from "../../config/env";
import { requestLogBody } from "../activity/activity.model";
import { recordRequest } from "../activity/activity.service";

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  // The gateway (or a service) asks: may this external client's request go through? Counts the call against the rate limit.
  // The key travels in the body, never in a URL or a log. Optional `permission` is the scope the endpoint needs, e.g. "vehicles:read".
  .post("/api-keys/verify", async ({ body }) => ok(await verifyApiKey(body.api_key, body.permission)), {
    body: t.Object({ api_key: t.String({ minLength: 1, maxLength: 200 }), permission: t.Optional(t.String({ maxLength: 40 })) }, { additionalProperties: false }),
  })
  // After the request was answered: one row in the API request log.
  .post("/request-logs", async ({ body, set }) => {
    await recordRequest(body);
    set.status = 201;
    return ok({ recorded: true });
  }, { body: requestLogBody });
