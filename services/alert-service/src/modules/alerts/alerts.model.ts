import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";

const alertType = t.Union([
  t.Literal("gps_offline"), t.Literal("overspeed"), t.Literal("geofence_enter"), t.Literal("geofence_exit"), t.Literal("system_anomaly"), t.Literal("job_assignment"),
]);
const alertStatus = t.Union([t.Literal("unread"), t.Literal("read"), t.Literal("handling"), t.Literal("resolved")]);
const dateTime = t.String({ format: "date-time" });

export const listQuery = t.Object({
  alert_status: t.Optional(alertStatus),
  alert_type: t.Optional(alertType),
  vehicle_id: t.Optional(idSchema),
  job_id: t.Optional(idSchema),
  from: t.Optional(dateTime), // triggered_at range
  to: t.Optional(dateTime),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
});
export const idParams = t.Object({ id: idSchema });

// Created by other services over /internal/alerts (transport-service: job assigned, job problem).
export const internalAlertBody = t.Object({
  company_id: idSchema,
  alert_type: t.Union([t.Literal("job_assignment"), t.Literal("system_anomaly")]),
  title: t.String({ minLength: 1, maxLength: 150, pattern: "\\S" }),
  detail: t.Optional(t.String({ maxLength: 5000 })),
  vehicle_id: t.Optional(t.Union([idSchema, t.Null()])),
  job_id: t.Optional(idSchema),
  recipient_user_id: t.Optional(t.Union([idSchema, t.Null()])),
  event_data: t.Optional(t.Record(t.String(), t.Any())),
}, { additionalProperties: false });

export interface AlertRecord {
  alert_id: bigint;
  company_id: bigint;
  vehicle_id: bigint | null;
  job_id: bigint | null;
  geofence_id: bigint | null;
  recipient_user_id: bigint | null;
  alert_type: string;
  title: string;
  detail: string | null;
  event_data: unknown;
  triggered_at: Date;
  alert_status: string;
  handled_by: bigint | null;
  resolved_at: Date | null;
}

const idOrNull = (id: bigint | null) => (id === null ? null : String(id));

export const publicAlert = (a: AlertRecord) => ({
  alert_id: String(a.alert_id),
  company_id: String(a.company_id),
  vehicle_id: idOrNull(a.vehicle_id),
  job_id: idOrNull(a.job_id),
  geofence_id: idOrNull(a.geofence_id),
  recipient_user_id: idOrNull(a.recipient_user_id),
  alert_type: a.alert_type,
  title: a.title,
  detail: a.detail,
  event_data: a.event_data ?? null,
  triggered_at: a.triggered_at.toISOString(),
  alert_status: a.alert_status,
  handled_by: idOrNull(a.handled_by),
  resolved_at: a.resolved_at === null ? null : a.resolved_at.toISOString(),
});
