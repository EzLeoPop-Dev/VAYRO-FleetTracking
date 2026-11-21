import { ApiError, parseId, type Caller } from "@vayro/service-kit";
import { canApply, NEXT, type AlertAction, type AlertStatus } from "../../domain/alerts";
import { advisoryLock } from "../../lib/lock";
import { audit } from "../../lib/audit";
import { prisma, type Db, type Prisma } from "../../lib/prisma";
import { publicAlert, type AlertRecord } from "./alerts.model";
import * as alerts from "./alerts.repository";

// company_id comes from the signed-in user. Company Admin and Dispatcher see every alert of their company;
// a Driver sees only the alerts addressed to them (recipient_user_id).
const companyOf = (me: Caller) => BigInt(me.company_id!);
const scopeFor = (me: Caller): Prisma.AlertWhereInput => ({ company_id: companyOf(me), ...(me.role === "driver" ? { recipient_user_id: BigInt(me.user_id) } : {}) });

async function load(db: Db, me: Caller, id: string): Promise<AlertRecord> {
  const row = await alerts.findOne(db, { alert_id: parseId(id), ...scopeFor(me) });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Alert not found");
  return row;
}

export async function listAlerts(me: Caller, q: { alert_status?: AlertStatus; alert_type?: "gps_offline" | "overspeed" | "geofence_enter" | "geofence_exit" | "system_anomaly" | "job_assignment"; vehicle_id?: string; job_id?: string; from?: string; to?: string; limit?: number; offset?: number }) {
  const where: Prisma.AlertWhereInput = {
    ...scopeFor(me),
    ...(q.alert_status ? { alert_status: q.alert_status } : {}),
    ...(q.alert_type ? { alert_type: q.alert_type } : {}),
    ...(q.vehicle_id ? { vehicle_id: parseId(q.vehicle_id) } : {}),
    ...(q.job_id ? { job_id: parseId(q.job_id) } : {}),
    ...(q.from || q.to ? { triggered_at: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
  };
  const limit = q.limit ?? 50, offset = q.offset ?? 0;
  const [rows, total] = await Promise.all([alerts.list(prisma, where, limit, offset), alerts.count(prisma, where)]);
  return { rows: rows.map(publicAlert), meta: { total, limit, offset } };
}

export async function getAlert(me: Caller, id: string) {
  return publicAlert(await load(prisma, me, id));
}

// read / handling / resolve. Marking an alert read that is already further along is not an error: nothing changes.
export async function changeAlert(me: Caller, id: string, action: AlertAction, ip: string | null) {
  const row = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `alert:item:${parseId(id)}`);
    const old = await load(tx, me, id);
    if (!canApply(old.alert_status as AlertStatus, action)) {
      if (action === "read") return old;
      throw new ApiError(409, "ALERT_STATE_CONFLICT", `A ${old.alert_status} alert cannot be ${action === "resolve" ? "resolved" : "taken for handling"}`);
    }
    const data: Prisma.AlertUncheckedUpdateInput = { alert_status: NEXT[action] };
    if (action === "handling") data.handled_by = BigInt(me.user_id);
    if (action === "resolve") { data.resolved_at = new Date(); data.handled_by = old.handled_by ?? BigInt(me.user_id); }
    const updated = await alerts.update(tx, old.alert_id, data);
    // Reading is frequent and says little; taking over and closing an alert are the changes worth an audit row.
    if (action !== "read") {
      await audit({ companyId: old.company_id, userId: me.user_id, action: `alert.${action}`, entityType: "alert", entityId: old.alert_id, oldValue: { alert_status: old.alert_status, handled_by: old.handled_by === null ? null : String(old.handled_by) }, newValue: { alert_status: updated.alert_status, handled_by: updated.handled_by === null ? null : String(updated.handled_by) }, ip }, tx);
    }
    return updated;
  });
  return publicAlert(row);
}

// For other services (transport-service). The caller is trusted, so it names the company itself.
export async function createInternalAlert(body: { company_id: string; alert_type: "job_assignment" | "system_anomaly"; title: string; detail?: string; vehicle_id?: string | null; job_id?: string; recipient_user_id?: string | null; event_data?: Record<string, unknown> }) {
  const row = await alerts.create(prisma, {
    company_id: parseId(body.company_id),
    alert_type: body.alert_type,
    title: body.title.trim(),
    detail: body.detail ?? null,
    vehicle_id: body.vehicle_id ? parseId(body.vehicle_id) : null,
    job_id: body.job_id ? parseId(body.job_id) : null,
    recipient_user_id: body.recipient_user_id ? parseId(body.recipient_user_id) : null,
    event_data: (body.event_data ?? undefined) as Prisma.InputJsonValue | undefined,
  });
  return publicAlert(row);
}
