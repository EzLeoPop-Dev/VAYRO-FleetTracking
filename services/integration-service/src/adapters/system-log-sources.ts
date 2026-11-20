import { internalClient } from "@vayro/service-kit";
import { config, SYSTEM_LOG_SOURCES } from "../config/env";
import type { MergedLog } from "../domain/system-logs";

export interface SourceLog extends MergedLog {
  company_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  result: string;
  ip_address: string | null;
}
export interface SourceStatus { source: string; status: "ok" | "unavailable" | "not_configured"; count: number }

export interface LogQuery { company_id?: string; action?: string; from?: string; to?: string; take: number }

// Asks every other service for its newest `take` audit rows, in parallel. One slow or broken service never fails the request:
// it is reported in the status list and its rows are simply missing.
export async function collectFromServices(q: LogQuery, only?: string): Promise<{ rows: SourceLog[][]; statuses: SourceStatus[] }> {
  const params = new URLSearchParams({ limit: String(Math.min(q.take, 200)) });
  for (const key of ["company_id", "action", "from", "to"] as const) if (q[key]) params.set(key, q[key]!);
  const results = await Promise.all(SYSTEM_LOG_SOURCES.filter((s) => !only || s.source === only).map(async ({ source, url }) => {
    if (!url) return { rows: [] as SourceLog[], status: { source, status: "not_configured" as const, count: 0 } };
    try {
      const { status, body } = await internalClient(url, config.internalToken)("GET", `/internal/system-logs?${params}`);
      if (status !== 200 || !Array.isArray(body?.data)) return { rows: [], status: { source, status: "unavailable" as const, count: 0 } };
      const rows = body.data as SourceLog[];
      return { rows, status: { source, status: "ok" as const, count: rows.length } };
    } catch {
      return { rows: [], status: { source, status: "unavailable" as const, count: 0 } };
    }
  }));
  return { rows: results.map((r) => r.rows), statuses: results.map((r) => r.status) };
}
