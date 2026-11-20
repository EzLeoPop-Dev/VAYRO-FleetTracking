import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";

const status = t.Union([t.Literal("active"), t.Literal("inactive")]);
const fields = {
  geofence_name: t.String({ minLength: 1, maxLength: 120, pattern: "\\S" }),
  center_latitude: t.Number({ minimum: -90, maximum: 90 }),
  center_longitude: t.Number({ minimum: -180, maximum: 180 }),
  radius_meters: t.Integer({ minimum: 1, maximum: 500000 }), // circles only (Data Dictionary); up to 500 km
};

export const createBody = t.Object({ ...fields, notify_enter: t.Optional(t.Boolean()), notify_exit: t.Optional(t.Boolean()) }, { additionalProperties: false });
// PUT: the circle is always sent in full; the two notify flags keep their value when omitted.
export const updateBody = createBody;
export const statusBody = t.Object({ geofence_status: status }, { additionalProperties: false });
export const idParams = t.Object({ id: idSchema });
export const listQuery = t.Object({
  geofence_status: t.Optional(status),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
});

interface Num { toNumber(): number }
export interface GeofenceRecord {
  geofence_id: bigint;
  company_id: bigint;
  geofence_name: string;
  center_latitude: Num;
  center_longitude: Num;
  radius_meters: bigint;
  notify_enter: boolean;
  notify_exit: boolean;
  geofence_status: string;
  created_by: bigint;
  created_at: Date;
  updated_at: Date;
}

export const publicGeofence = (g: GeofenceRecord) => ({
  geofence_id: String(g.geofence_id),
  company_id: String(g.company_id),
  geofence_name: g.geofence_name,
  center_latitude: g.center_latitude.toNumber(),
  center_longitude: g.center_longitude.toNumber(),
  radius_meters: Number(g.radius_meters),
  notify_enter: g.notify_enter,
  notify_exit: g.notify_exit,
  geofence_status: g.geofence_status,
  created_by: String(g.created_by),
  created_at: g.created_at.toISOString(),
  updated_at: g.updated_at.toISOString(),
});
