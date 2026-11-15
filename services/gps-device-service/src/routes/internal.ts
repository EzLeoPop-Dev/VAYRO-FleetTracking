import { ApiError, http, idSchema, internalGuard, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { deviceByCode, markReceived } from "../application/devices";
import { config } from "../config/env";

// Service-to-service API for gps-data-service. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  .get("/devices/by-code", async ({ query }) => {
    const device = await deviceByCode(query.company_id, query.device_code);
    if (!device) throw new ApiError(404, "NOT_FOUND", "GPS device not found");
    return ok(device);
  }, { query: t.Object({ company_id: idSchema, device_code: t.String({ minLength: 1, maxLength: 100 }) }) })
  .post("/devices/:id/received", async ({ params, body }) => {
    await markReceived(params.id, new Date(body.received_at));
    return ok(null);
  }, { params: t.Object({ id: idSchema }), body: t.Object({ received_at: t.String({ format: "date-time" }) }) });
