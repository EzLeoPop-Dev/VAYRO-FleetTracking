import { http, idSchema, internalGuard, ok, parseId, parseIdList } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { latestByVehicle, vehicleStats } from "../application/fleet-stats";
import { historyFor, latestFor } from "../application/query-locations";
import { config } from "../config/env";

const idList = t.Optional(t.String({ maxLength: 2500, pattern: "^[0-9, ]*$" }));

// Service-to-service API for vehicle-tracking, route-history, alert and reporting services.
// Not reachable through the gateway; every call needs the internal token. The caller has already checked who may see what.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  .get("/locations/latest", async ({ query }) => ok(await latestFor(query.company_id, query.vehicle_id)), { query: t.Object({ company_id: idSchema, vehicle_id: idSchema }) })
  // The newest point of every vehicle of a company (or only of vehicle_ids, comma separated, at most 100).
  .get("/locations/latest-by-vehicle", async ({ query }) => ok(await latestByVehicle(query.company_id, parseIdList(query.vehicle_ids, parseId, 100))), {
    query: t.Object({ company_id: idSchema, vehicle_ids: idList }),
  })
  // Per-vehicle aggregates over [from, to] (at most 31 days): distance, speeds, gaps, abnormal and late points.
  .get("/stats/vehicles", async ({ query }) => ok(await vehicleStats(query.company_id, new Date(query.from), new Date(query.to), parseIdList(query.vehicle_ids, parseId, 100))), {
    query: t.Object({ company_id: idSchema, from: t.String({ format: "date-time" }), to: t.String({ format: "date-time" }), vehicle_ids: idList }),
  })
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
