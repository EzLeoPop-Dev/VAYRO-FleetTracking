import { ApiError, http, idSchema, internalGuard, ok, parseId, parseIdList } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { deviceByCode, deviceStats, devicesOfVehicles, markReceived } from "../application/devices";
import { config } from "../config/env";

// Service-to-service API for gps-data-service and reporting-service. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  .get("/devices/by-code", async ({ query }) => {
    const device = await deviceByCode(query.company_id, query.device_code);
    if (!device) throw new ApiError(404, "NOT_FOUND", "GPS device not found");
    return ok(device);
  }, { query: t.Object({ company_id: idSchema, device_code: t.String({ minLength: 1, maxLength: 100 }) }) })
  // For reporting-service: counts by derived connection status, for one company or the whole platform.
  .get("/stats/devices", async ({ query }) => ok(await deviceStats(query.company_id)), { query: t.Object({ company_id: t.Optional(idSchema) }) })
  // For reporting-service: the devices of a company, optionally only those of the given vehicles (comma separated ids).
  .get("/devices", async ({ query }) => ok(await devicesOfVehicles(query.company_id, parseIdList(query.vehicle_ids, parseId, 100))), {
    query: t.Object({ company_id: idSchema, vehicle_ids: t.Optional(t.String({ maxLength: 2500, pattern: "^[0-9, ]*$" })) }),
  })
  .post("/devices/:id/received", async ({ params, body }) => {
    await markReceived(params.id, new Date(body.received_at));
    return ok(null);
  }, { params: t.Object({ id: idSchema }), body: t.Object({ received_at: t.String({ format: "date-time" }) }) });
