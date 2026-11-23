import { ApiError, parseId, type Caller } from "@vayro/service-kit";
import { audit } from "../../lib/audit";
import { prisma, type Db } from "../../lib/prisma";
import { publicGeofence } from "./geofences.model";
import * as geofences from "./geofences.repository";

const companyOf = (me: Caller) => BigInt(me.company_id!);

async function load(db: Db, me: Caller, id: string) {
  const row = await geofences.findOne(db, parseId(id), companyOf(me));
  if (!row) throw new ApiError(404, "NOT_FOUND", "Geofence not found");
  return row;
}

export async function listGeofences(me: Caller, q: { geofence_status?: "active" | "inactive"; limit?: number; offset?: number }) {
  const where = { company_id: companyOf(me), ...(q.geofence_status ? { geofence_status: q.geofence_status } : {}) };
  const limit = q.limit ?? 50, offset = q.offset ?? 0;
  const [rows, total] = await Promise.all([geofences.list(prisma, where, limit, offset), geofences.count(prisma, where)]);
  return { rows: rows.map(publicGeofence), meta: { total, limit, offset } };
}

interface Circle { geofence_name: string; center_latitude: number; center_longitude: number; radius_meters: number; notify_enter?: boolean; notify_exit?: boolean }

export async function createGeofence(me: Caller, body: Circle, ip: string | null) {
  const row = await prisma.$transaction(async (tx) => {
    const created = await geofences.create(tx, {
      company_id: companyOf(me), geofence_name: body.geofence_name.trim(), center_latitude: body.center_latitude, center_longitude: body.center_longitude,
      radius_meters: BigInt(body.radius_meters), notify_enter: body.notify_enter ?? true, notify_exit: body.notify_exit ?? true, created_by: BigInt(me.user_id),
    });
    await audit({ companyId: created.company_id, userId: me.user_id, action: "geofence.create", entityType: "geofence", entityId: created.geofence_id, newValue: publicGeofence(created), ip }, tx);
    return created;
  });
  return publicGeofence(row);
}

export async function updateGeofence(me: Caller, id: string, body: Circle, ip: string | null) {
  const row = await prisma.$transaction(async (tx) => {
    const old = await load(tx, me, id);
    const updated = await geofences.update(tx, old.geofence_id, {
      geofence_name: body.geofence_name.trim(), center_latitude: body.center_latitude, center_longitude: body.center_longitude, radius_meters: BigInt(body.radius_meters),
      ...(body.notify_enter !== undefined ? { notify_enter: body.notify_enter } : {}), ...(body.notify_exit !== undefined ? { notify_exit: body.notify_exit } : {}),
    });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "geofence.update", entityType: "geofence", entityId: old.geofence_id, oldValue: publicGeofence(old), newValue: publicGeofence(updated), ip }, tx);
    return updated;
  });
  return publicGeofence(row);
}

export async function setGeofenceStatus(me: Caller, id: string, status: "active" | "inactive", ip: string | null) {
  const row = await prisma.$transaction(async (tx) => {
    const old = await load(tx, me, id);
    const updated = await geofences.update(tx, old.geofence_id, { geofence_status: status });
    await audit({ companyId: old.company_id, userId: me.user_id, action: `geofence.${status === "active" ? "activate" : "deactivate"}`, entityType: "geofence", entityId: old.geofence_id, oldValue: publicGeofence(old), newValue: publicGeofence(updated), ip }, tx);
    return updated;
  });
  return publicGeofence(row);
}

// A geofence that alerts point at is history: switch it off instead. The database refuses the delete as well (foreign key).
export async function deleteGeofence(me: Caller, id: string, ip: string | null) {
  try {
    await prisma.$transaction(async (tx) => {
      const old = await load(tx, me, id);
      if ((await geofences.alertCount(tx, old.geofence_id)) > 0) throw new ApiError(409, "GEOFENCE_IN_USE", "Alerts refer to this geofence; deactivate it instead of deleting it");
      await geofences.remove(tx, old.geofence_id);
      await audit({ companyId: old.company_id, userId: me.user_id, action: "geofence.delete", entityType: "geofence", entityId: old.geofence_id, oldValue: publicGeofence(old), ip }, tx);
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2003") throw new ApiError(409, "GEOFENCE_IN_USE", "Alerts refer to this geofence; deactivate it instead of deleting it");
    throw err;
  }
}
