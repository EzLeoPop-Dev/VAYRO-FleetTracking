import { http, idSchema, internalGuard, ok, parseId } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { config } from "./config/env";
import { prisma } from "./lib/prisma";

// GET /internal/system-logs: this service's own audit rows, for integration-service's GET /api/v1/system-logs view.
// Newest first. Not reachable through the gateway; the caller has already decided who may see which company.
export const systemLogs = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  .get("/system-logs", async ({ query }) => {
    const rows = await prisma.systemLog.findMany({
      where: {
        ...(query.company_id ? { company_id: parseId(query.company_id) } : {}),
        ...(query.action ? { action: { startsWith: query.action } } : {}),
        ...(query.from || query.to ? { created_at: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
      },
      orderBy: [{ created_at: "desc" }, { system_log_id: "desc" }],
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    });
    return ok(rows.map((row) => ({
      system_log_id: String(row.system_log_id),
      source: "alert-service",
      company_id: row.company_id === null ? null : String(row.company_id),
      user_id: row.user_id === null ? null : String(row.user_id),
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      old_value: row.old_value ?? null,
      new_value: row.new_value ?? null,
      result: row.result,
      ip_address: row.ip_address,
      created_at: row.created_at.toISOString(),
    })));
  }, {
    query: t.Object({
      company_id: t.Optional(idSchema),
      action: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
      from: t.Optional(t.String({ format: "date-time" })),
      to: t.Optional(t.String({ format: "date-time" })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200, multipleOf: 1 })),
      offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
    }),
  });
