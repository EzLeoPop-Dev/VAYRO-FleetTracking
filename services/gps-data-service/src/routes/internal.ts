import { http, idSchema, internalGuard, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { historyFor, latestFor } from "../application/query-locations";
import { config } from "../config/env";

// Service-to-service API for vehicle-tracking, route-history, alert and reporting services.
// Not reachable through the gateway; every call needs the internal token. The caller has already checked who may see what.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  .get("/locations/latest", async ({ query }) => ok(await latestFor(query.company_id, query.vehicle_id)), { query: t.Object({ company_id: idSchema, vehicle_id: idSchema }) })
  .get("/locations", async ({ query }) => {
    const { rows, meta } = await historyFor(query.company_id, query.vehicle_id, query);
    return { ...ok(rows), meta };
  }, {
    query: t.Object({
      company_id: idSchema,
      vehicle_id: idSchema,
      from: t.Optional(t.String({ format: "date-time" })),
      to: t.Optional(t.String({ format: "date-time" })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500, multipleOf: 1 })),
    }),
  });
