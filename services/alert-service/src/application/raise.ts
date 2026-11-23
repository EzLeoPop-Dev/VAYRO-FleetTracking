import type { Db, Prisma } from "../lib/prisma";
import * as alerts from "../modules/alerts/alerts.repository";

type NewAlert = Prisma.AlertUncheckedCreateInput & { company_id: bigint; vehicle_id: bigint };

// Creates the alert unless the same one (vehicle + type + title) is still open and recent.
// This is what keeps "the same speeding vehicle" from filling the list with one alert per GPS point.
export async function raiseOnce(db: Db, alert: NewAlert, cooldownMs: number): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMs);
  if (await alerts.hasRecentOpen(db, { company_id: alert.company_id, vehicle_id: alert.vehicle_id, alert_type: alert.alert_type, title: alert.title }, since)) return false;
  await alerts.create(db, alert);
  return true;
}
