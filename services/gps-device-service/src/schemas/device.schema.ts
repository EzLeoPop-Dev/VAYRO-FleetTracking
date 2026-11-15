import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";
import { connectionStatus } from "../domain/device";
import type { DeviceRow } from "../infrastructure/device.repository";

// ---- request schemas ----
const nullableText = (maxLength: number) => t.Optional(t.Union([t.String({ maxLength }), t.Null()]));
const sourceSchema = t.Union([t.Literal("gps_device"), t.Literal("provider_api"), t.Literal("driver_mobile_app")]);
const configSchema = t.Optional(t.Union([t.Record(t.String(), t.Unknown()), t.Null()]));
// Write-only: stored encrypted, never returned. null removes the stored credentials.
const credentialsSchema = t.Optional(t.Union([t.Record(t.String(), t.Unknown(), { maxProperties: 20 }), t.Null()]));
const deviceCodeSchema = t.String({ minLength: 1, maxLength: 100, pattern: "\\S" });

export const idParams = t.Object({ id: idSchema });
export const listDevicesQuery = t.Object({
  company_id: t.Optional(idSchema),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500, multipleOf: 1 })),
  offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
});
export const createDeviceBody = t.Object(
  { company_id: t.Optional(idSchema), vehicle_id: idSchema, device_code: deviceCodeSchema, source_type: sourceSchema, provider_name: nullableText(120), connection_config: configSchema, credentials: credentialsSchema },
  { additionalProperties: false },
);
export const updateDeviceBody = t.Object(
  { vehicle_id: t.Optional(idSchema), device_code: t.Optional(deviceCodeSchema), source_type: t.Optional(sourceSchema), provider_name: nullableText(120), connection_config: configSchema, credentials: credentialsSchema },
  { additionalProperties: false, minProperties: 1 },
);

// ---- response mapping (database row -> public API shape; BIGINT ids become strings) ----
export function toGpsDevice(row: DeviceRow) {
  return {
    gps_device_id: String(row.gps_device_id),
    company_id: String(row.company_id),
    vehicle_id: String(row.vehicle_id),
    device_code: row.device_code,
    source_type: row.source_type,
    provider_name: row.provider_name,
    connection_config: row.connection_config,
    has_credentials: row.credentials_encrypted !== null,
    connection_status: connectionStatus(row),
    last_received_at: row.last_received_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
