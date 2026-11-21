import { ApiError, parseId, type Caller } from "@vayro/service-kit";
import { collectFromServices, type SourceLog } from "../../adapters/system-log-sources";
import { loggablePath } from "../../domain/api-key";
import { mergeNewestFirst, MAX_WINDOW } from "../../domain/system-logs";
import { prisma } from "../../lib/prisma";
import { publicRequestLog } from "./activity.model";

// A Company Admin is always limited to their own company. A Platform Admin sees every company unless they name one.
const companyScope = (me: Caller, requested?: string): bigint | undefined => (me.role === "platform_admin" ? (requested ? parseId(requested) : undefined) : BigInt(me.company_id!));

export async function listRequestLogs(me: Caller, q: { integration_id?: string; company_id?: string; http_method?: string; http_status?: number; from?: string; to?: string; limit?: number; offset?: number }) {
  const company = companyScope(me, q.company_id);
  const where = {
    ...(company !== undefined ? { company_id: company } : {}),
    ...(q.integration_id ? { integration_id: parseId(q.integration_id) } : {}),
    ...(q.http_method ? { http_method: q.http_method.toUpperCase() } : {}),
    ...(q.http_status ? { http_status: q.http_status } : {}),
    ...(q.from || q.to ? { request_at: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
  };
  const limit = q.limit ?? 50, offset = q.offset ?? 0;
  const [rows, total] = await Promise.all([
    prisma.apiRequestLog.findMany({ where, orderBy: [{ request_at: "desc" }, { api_log_id: "desc" }], take: limit, skip: offset }),
    prisma.apiRequestLog.count({ where }),
  ]);
  return { rows: rows.map(publicRequestLog), meta: { total, limit, offset } };
}

// Called by the gateway or a service. Never receives or keeps headers, keys or query strings.
export async function recordRequest(body: { integration_id?: string | null; company_id: string; http_method: string; endpoint: string; http_status?: number | null; duration_ms?: number | null; request_id?: string | null; source_ip?: string | null }) {
  try {
    await prisma.apiRequestLog.create({
      data: {
        integration_id: body.integration_id ? parseId(body.integration_id) : null,
        company_id: parseId(body.company_id),
        http_method: body.http_method.toUpperCase(),
        endpoint: loggablePath(body.endpoint),
        http_status: body.http_status ?? null,
        duration_ms: body.duration_ms ?? null,
        request_id: body.request_id ?? null,
        source_ip: body.source_ip ?? null,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2003") throw new ApiError(422, "VALIDATION_ERROR", "Unknown integration_id");
    throw err;
  }
}

// The audit trail of the whole platform: this service's own rows plus every other service's, newest first.
export async function listSystemLogs(me: Caller, q: { company_id?: string; source?: string; action?: string; from?: string; to?: string; limit?: number; offset?: number }) {
  const limit = q.limit ?? 50, offset = q.offset ?? 0;
  if (offset + limit > MAX_WINDOW) throw new ApiError(422, "VALIDATION_ERROR", `offset + limit must not exceed ${MAX_WINDOW}`);
  const company = companyScope(me, q.company_id);
  const take = offset + limit;
  const filter = { company_id: company === undefined ? undefined : String(company), action: q.action, from: q.from, to: q.to, take };

  const wantOwn = !q.source || q.source === "integration-service";
  const own: SourceLog[] = wantOwn
    ? (await prisma.systemLog.findMany({
        where: {
          ...(company !== undefined ? { company_id: company } : {}),
          ...(q.action ? { action: { startsWith: q.action } } : {}),
          ...(q.from || q.to ? { created_at: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
        },
        orderBy: [{ created_at: "desc" }, { system_log_id: "desc" }],
        take,
      })).map((row) => ({
        system_log_id: String(row.system_log_id), source: "integration-service", company_id: row.company_id === null ? null : String(row.company_id),
        user_id: row.user_id === null ? null : String(row.user_id), action: row.action, entity_type: row.entity_type, entity_id: row.entity_id,
        old_value: row.old_value ?? null, new_value: row.new_value ?? null, result: row.result, ip_address: row.ip_address, created_at: row.created_at.toISOString(),
      }))
    : [];

  const others = q.source === "integration-service" ? { rows: [] as SourceLog[][], statuses: [] } : await collectFromServices(filter, q.source);
  if (q.source && q.source !== "integration-service" && others.statuses.length === 0) throw new ApiError(422, "VALIDATION_ERROR", `Unknown source: ${q.source}`);
  const statuses = [...(wantOwn ? [{ source: "integration-service", status: "ok" as const, count: own.length }] : []), ...others.statuses];
  return { rows: mergeNewestFirst([own, ...others.rows], offset, limit), meta: { limit, offset, sources: statuses } };
}
