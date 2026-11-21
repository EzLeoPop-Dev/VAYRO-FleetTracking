import { isOffline, OFFLINE_COOLDOWN_MS, OFFLINE_LOOKBACK_MS } from "../domain/alerts";
import * as signal from "../infrastructure/signal.repository";
import { advisoryLock } from "../lib/lock";
import { prisma } from "../lib/prisma";
import * as rules from "../modules/rules/rules.repository";
import { raiseOnce } from "./raise";

// "GPS offline": a vehicle that was heard from before, but not for longer than the company's threshold.
// One alert per silence: offline_alerted stays true until the vehicle reports again.
// Looks only at vehicles this service has already seen, so a vehicle that never reported is not "offline".
export async function scanOffline(now = new Date()): Promise<number> {
  const offlineRules = await prisma.alertRule.findMany({ where: { rule_type: "gps_offline", is_enabled: true, threshold_value: { not: null } } });
  let raised = 0;
  for (const rule of offlineRules) {
    const minutes = rule.threshold_value!.toNumber();
    const stale = await signal.staleFor(prisma, rule.company_id, new Date(now.getTime() - minutes * 60_000), new Date(now.getTime() - OFFLINE_LOOKBACK_MS));
    for (const found of stale) {
      await prisma.$transaction(async (tx) => {
        await advisoryLock(tx, `alert:vehicle:${found.vehicle_id}`);
        const state = await signal.find(tx, found.vehicle_id); // it may have reported while we were looking
        if (!state || state.offline_alerted || !isOffline(state.last_received_at, now, minutes)) return;
        const created = await raiseOnce(tx, {
          company_id: state.company_id, vehicle_id: state.vehicle_id, alert_type: "gps_offline", title: "GPS offline",
          detail: `No GPS data received for at least ${minutes} minutes`,
          event_data: { reason: "gps_offline", threshold_minutes: minutes, last_received_at: state.last_received_at.toISOString(), last_recorded_at: state.last_recorded_at.toISOString() },
        }, OFFLINE_COOLDOWN_MS);
        await signal.markOfflineAlerted(tx, state.vehicle_id);
        if (created) raised++;
      });
    }
  }
  return raised;
}

// Called on a timer by index.ts. A failed round is logged and the next one runs normally.
export function startOfflineScanner(everySeconds: number) {
  const timer = setInterval(() => {
    scanOffline().catch((err) => console.error("offline scan failed:", err instanceof Error ? err.message : "unknown error"));
  }, everySeconds * 1000);
  timer.unref?.();
  return timer;
}
