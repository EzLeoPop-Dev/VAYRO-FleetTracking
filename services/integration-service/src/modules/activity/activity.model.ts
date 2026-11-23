import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";

const dateTime = t.String({ format: "date-time" });

export const integrationLogQuery = t.Object({
  integration_id: t.Optional(idSchema),
  company_id: t.Optional(idSchema), // Platform Admin only
  http_method: t.Optional(t.String({ pattern: "^[A-Za-z]{3,10}$" })),
  http_status: t.Optional(t.Numeric({ minimum: 100, maximum: 599, multipleOf: 1 })),
  from: t.Optional(dateTime),
  to: t.Optional(dateTime),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
});

export const systemLogQuery = t.Object({
  company_id: t.Optional(idSchema), // Platform Admin only; a Company Admin always sees their own company
  source: t.Optional(t.String({ minLength: 1, maxLength: 40 })), // one service, e.g. "transport-service"
  action: t.Optional(t.String({ minLength: 1, maxLength: 120 })), // prefix, e.g. "job." or "integration.revoke"
  from: t.Optional(dateTime),
  to: t.Optional(dateTime),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  offset: t.Optional(t.Numeric({ minimum: 0, maximum: 199, multipleOf: 1 })), // offset + limit must stay within 200
});

interface RequestLogRecord {
  api_log_id: bigint;
  integration_id: bigint | null;
  company_id: bigint;
  http_method: string;
  endpoint: string;
  http_status: number | null;
  request_at: Date;
  duration_ms: bigint | null;
  request_id: string | null;
  source_ip: string | null;
}

export const publicRequestLog = (r: RequestLogRecord) => ({
  api_log_id: String(r.api_log_id),
  integration_id: r.integration_id === null ? null : String(r.integration_id),
  company_id: String(r.company_id),
  http_method: r.http_method,
  endpoint: r.endpoint,
  http_status: r.http_status,
  request_at: r.request_at.toISOString(),
  duration_ms: r.duration_ms === null ? null : Number(r.duration_ms),
  request_id: r.request_id,
  source_ip: r.source_ip,
});

// Body of POST /internal/request-logs: what the gateway (or a service) records after answering an external client.
export const requestLogBody = t.Object({
  integration_id: t.Optional(t.Union([idSchema, t.Null()])),
  company_id: idSchema,
  http_method: t.String({ pattern: "^[A-Za-z]{3,10}$" }),
  endpoint: t.String({ minLength: 1, maxLength: 2000 }),
  http_status: t.Optional(t.Union([t.Integer({ minimum: 100, maximum: 599 }), t.Null()])),
  duration_ms: t.Optional(t.Union([t.Integer({ minimum: 0, maximum: 3600000 }), t.Null()])),
  request_id: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  source_ip: t.Optional(t.Union([t.String({ maxLength: 45 }), t.Null()])),
}, { additionalProperties: false });
