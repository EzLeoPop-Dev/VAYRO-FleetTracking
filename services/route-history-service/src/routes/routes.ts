import { http, idSchema, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { loadRoute } from "../application/load-route";
import { summarize } from "../domain/route";
import { authed } from "../plugins/guard";

const params = t.Object({ id: idSchema });
const rangeQuery = t.Object({ from: t.Optional(t.String({ format: "date-time" })), to: t.Optional(t.String({ format: "date-time" })) });
const pointsQuery = t.Object({
  from: t.Optional(t.String({ format: "date-time" })),
  to: t.Optional(t.String({ format: "date-time" })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 1000, multipleOf: 1 })),
  offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
});

const rangeMeta = (route: Awaited<ReturnType<typeof loadRoute>>) => ({ from: route.from, to: route.to, truncated: route.truncated, ...(route.windows ? { windows: route.windows } : {}) });

// Company Admin and Dispatcher: any vehicle of the company. Driver: only their own job time on that vehicle.
export const routeRoutes = new Elysia({ prefix: "/api/v1/routes" }).use(http).use(authed("company_admin", "dispatcher", "driver"))
  // The whole route in one answer: summary plus every point (at most 5 000), oldest first, for drawing it on the map.
  .get("/vehicles/:id", async ({ me, params, query }) => {
    const route = await loadRoute(me, params.id, query);
    return { ...ok({ vehicle_id: route.vehicle_id, from: route.from, to: route.to, summary: summarize(route.points), points: route.points }), meta: rangeMeta(route) };
  }, { params, query: rangeQuery })
  // The points only, paged, oldest first.
  .get("/vehicles/:id/points", async ({ me, params, query }) => {
    const route = await loadRoute(me, params.id, query);
    const limit = query.limit ?? 200, offset = query.offset ?? 0;
    return { ...ok(route.points.slice(offset, offset + limit)), meta: { ...rangeMeta(route), total: route.points.length, limit, offset } };
  }, { params, query: pointsQuery })
  .get("/vehicles/:id/summary", async ({ me, params, query }) => {
    const route = await loadRoute(me, params.id, query);
    return { ...ok({ vehicle_id: route.vehicle_id, ...summarize(route.points) }), meta: rangeMeta(route) };
  }, { params, query: rangeQuery });
