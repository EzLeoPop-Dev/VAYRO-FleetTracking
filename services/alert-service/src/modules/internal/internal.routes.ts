import { http, idSchema, internalGuard, ok, optionalWindow, parseId, sum, zeroFilled } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { config } from "../../config/env";
import { Prisma, prisma } from "../../lib/prisma";

const TYPES = ["gps_offline", "overspeed", "geofence_enter", "geofence_exit", "system_anomaly", "job_assignment"] as const;
const STATUSES = ["unread", "read", "handling", "resolved"] as const;
const dateTime = t.String({ format: "date-time" });
const iso = (d: Date | null) => d?.toISOString() ?? null;
const idOrNull = (v: bigint | null) => (v === null ? null : String(v));

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
// Read-only views for reporting-service. An alert's window is its triggered_at.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  // Alerts triggered in the window counted by type and by status, how many alerts are still open (any time), and the
  // average time resolved alerts took. company_id is optional (Platform Admin overview).
  .get("/stats/alerts", async ({ query }) => {
    const window = optionalWindow(query.from, query.to);
    const company = query.company_id ? { company_id: parseId(query.company_id) } : {};
    const where = { ...company, ...(window.gte || window.lte ? { triggered_at: window } : {}) };
    const [types, statuses, open_total, [avg]] = await Promise.all([
      prisma.alert.groupBy({ by: ["alert_type"], where, _count: { _all: true } }),
      prisma.alert.groupBy({ by: ["alert_status"], where, _count: { _all: true } }),
      prisma.alert.count({ where: { ...company, alert_status: { not: "resolved" } } }),
      prisma.$queryRaw<{ minutes: number | null }[]>(Prisma.sql`
        SELECT avg(EXTRACT(EPOCH FROM (resolved_at - triggered_at)) / 60)::float8 AS minutes
        FROM alerts
        WHERE alert_status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at >= triggered_at
          ${query.company_id ? Prisma.sql`AND company_id = ${parseId(query.company_id)}` : Prisma.empty}
          ${window.gte ? Prisma.sql`AND triggered_at >= ${window.gte}` : Prisma.empty}
          ${window.lte ? Prisma.sql`AND triggered_at <= ${window.lte}` : Prisma.empty}`),
    ]);
    const by_type = zeroFilled(TYPES, types.map((r) => [r.alert_type, r._count._all] as const));
    const by_status = zeroFilled(STATUSES, statuses.map((r) => [r.alert_status, r._count._all] as const));
    return ok({ total: sum(by_type), by_type, by_status, open_total, avg_resolution_minutes: avg?.minutes === null || avg?.minutes === undefined ? null : Math.round(avg.minutes) });
  }, { query: t.Object({ company_id: t.Optional(idSchema), from: t.Optional(dateTime), to: t.Optional(dateTime) }) })
  // One page of a company's alerts triggered in the window, newest first, optionally one type and/or status.
  .get("/alerts", async ({ query }) => {
    const window = optionalWindow(query.from, query.to);
    const where = {
      company_id: parseId(query.company_id),
      ...(query.type ? { alert_type: query.type } : {}),
      ...(query.status ? { alert_status: query.status } : {}),
      ...(window.gte || window.lte ? { triggered_at: window } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.alert.findMany({ where, orderBy: [{ triggered_at: "desc" }, { alert_id: "desc" }], take: query.limit ?? 100, skip: query.offset ?? 0 }),
      prisma.alert.count({ where }),
    ]);
    return ok({
      total,
      rows: rows.map((a) => ({
        alert_id: String(a.alert_id),
        alert_type: a.alert_type,
        title: a.title,
        alert_status: a.alert_status,
        vehicle_id: idOrNull(a.vehicle_id),
        job_id: idOrNull(a.job_id),
        geofence_id: idOrNull(a.geofence_id),
        triggered_at: a.triggered_at.toISOString(),
        handled_by: idOrNull(a.handled_by),
        resolved_at: iso(a.resolved_at),
        resolution_minutes: a.resolved_at && a.resolved_at >= a.triggered_at ? Math.round((a.resolved_at.getTime() - a.triggered_at.getTime()) / 60_000) : null,
      })),
    });
  }, {
    query: t.Object({
      company_id: idSchema,
      from: t.Optional(dateTime),
      to: t.Optional(dateTime),
      type: t.Optional(t.Union(TYPES.map((s) => t.Literal(s)))),
      status: t.Optional(t.Union(STATUSES.map((s) => t.Literal(s)))),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500, multipleOf: 1 })),
      offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
    }),
  });
