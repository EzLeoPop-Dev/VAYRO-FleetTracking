import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";
import { freshness, type Anomaly } from "../domain/gps";
import type { LocationRow } from "../infrastructure/location.repository";

// ---- request schemas ----
export const vehicleParams = t.Object({ vehicleId: idSchema });
export const historyQuery = t.Object({
  from: t.Optional(t.String({ format: "date-time" })),
  to: t.Optional(t.String({ format: "date-time" })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500, multipleOf: 1 })),
});
export const ingestBody = t.Object(
  {
    device_code: t.String({ minLength: 1, maxLength: 100, pattern: "\\S" }),
    external_record_id: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 100, pattern: "\\S" }), t.Null()])),
    recorded_at: t.String({ format: "date-time" }),
    latitude: t.Number({ minimum: -90, maximum: 90 }),
    longitude: t.Number({ minimum: -180, maximum: 180 }),
    speed_kmh: t.Optional(t.Union([t.Number({ minimum: 0, maximum: 99999.99 }), t.Null()])),
    direction_degree: t.Optional(t.Union([t.Integer({ minimum: 0, maximum: 359 }), t.Null()])),
    accuracy_meters: t.Optional(t.Union([t.Number({ minimum: 0, maximum: 999999.99 }), t.Null()])),
  },
  { additionalProperties: false },
);

// ---- response mapping (database row -> public API shape; BIGINT ids become strings) ----
export function toGpsLocation(row: LocationRow, anomalies: Anomaly[] = []) {
  return {
    gps_location_id: String(row.gps_location_id),
    company_id: String(row.company_id),
    vehicle_id: String(row.vehicle_id),
    gps_device_id: row.gps_device_id === null ? null : String(row.gps_device_id),
    external_record_id: row.external_record_id,
    latitude: row.latitude.toNumber(),
    longitude: row.longitude.toNumber(),
    speed_kmh: row.speed_kmh?.toNumber() ?? null,
    direction_degree: row.direction_degree,
    accuracy_meters: row.accuracy_meters?.toNumber() ?? null,
    recorded_at: row.recorded_at.toISOString(),
    received_at: row.received_at.toISOString(),
    freshness: freshness(row.recorded_at),
    anomalies,
  };
}
