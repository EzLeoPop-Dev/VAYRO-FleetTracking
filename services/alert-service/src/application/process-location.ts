import { ANOMALY_COOLDOWN_MS, exceedsSpeed, geofenceTransitions, isUsablePoint, OVERSPEED_COOLDOWN_MS, type Fence } from "../domain/alerts";
import * as signal from "../infrastructure/signal.repository";
import { advisoryLock } from "../lib/lock";
import { prisma } from "../lib/prisma";
import * as geofences from "../modules/geofences/geofences.repository";
import * as rules from "../modules/rules/rules.repository";
import { raiseOnce } from "./raise";

// One stored GPS point as gps-data-service publishes it (POST /internal/gps/locations).
export interface LocationEvent {
  company_id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  recorded_at: string;
  received_at: string;
  freshness: "current" | "delayed";
  anomalies: string[];
  gps_location_id?: string;
}

// What a new point can change: abnormal-data alert, overspeed alert, geofence enter/exit alerts, and the vehicle's signal state.
// Only a current point without anomalies moves the vehicle's known position or raises overspeed/geofence alerts:
// old points (an offline queue being flushed) and bad fixes are never presented as where the vehicle is now.
export async function processLocation(loc: LocationEvent) {
  const companyId = BigInt(loc.company_id), vehicleId = BigInt(loc.vehicle_id);
  const recordedAt = new Date(loc.recorded_at), receivedAt = new Date(loc.received_at);
  const [ruleRows, fenceRows] = await Promise.all([rules.enabledFor(prisma, companyId), geofences.activeFor(prisma, companyId)]);
  const fences: Fence[] = fenceRows.map((f) => ({
    id: String(f.geofence_id), name: f.geofence_name, latitude: f.center_latitude.toNumber(), longitude: f.center_longitude.toNumber(),
    radius_meters: Number(f.radius_meters), notify_enter: f.notify_enter, notify_exit: f.notify_exit,
  }));
  const overspeed = ruleRows.find((r) => r.rule_type === "overspeed" && r.threshold_value !== null);
  const usable = isUsablePoint(loc);
  const where = { latitude: loc.latitude, longitude: loc.longitude, recorded_at: loc.recorded_at, gps_location_id: loc.gps_location_id ?? null };

  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `alert:vehicle:${vehicleId}`); // events for one vehicle are handled one at a time
    const state = await signal.find(tx, vehicleId);
    const newest = !state || recordedAt.getTime() > state.last_recorded_at.getTime();
    const advance = usable && newest;
    const base = { company_id: companyId, vehicle_id: vehicleId, triggered_at: recordedAt };

    if (loc.anomalies.length > 0) {
      await raiseOnce(tx, { ...base, alert_type: "system_anomaly", title: "GPS data anomaly", detail: `Abnormal GPS data: ${loc.anomalies.join(", ")}`, event_data: { ...where, reason: "gps_anomaly", anomalies: loc.anomalies } }, ANOMALY_COOLDOWN_MS);
    }

    if (advance && overspeed && exceedsSpeed(loc.speed_kmh, overspeed.threshold_value!.toNumber())) {
      const limit = overspeed.threshold_value!.toNumber();
      await raiseOnce(tx, { ...base, alert_type: "overspeed", title: "Overspeed", detail: `Speed ${loc.speed_kmh} km/h is above the ${limit} km/h limit`, event_data: { ...where, speed_kmh: loc.speed_kmh, threshold_kmh: limit } }, OVERSPEED_COOLDOWN_MS);
    }

    let inside = state ? state.inside_geofence_ids.map(String) : [];
    if (advance) {
      const moves = geofenceTransitions(inside, fences, loc);
      inside = moves.inside;
      // The first usable point only sets the starting position: we do not know where the vehicle was before it.
      if (state?.baseline_set) {
        for (const fence of moves.entered.filter((f) => f.notify_enter)) {
          await tx.alert.create({ data: { ...base, geofence_id: BigInt(fence.id), alert_type: "geofence_enter", title: `Entered geofence: ${fence.name}`, event_data: where } });
        }
        for (const fence of moves.exited.filter((f) => f.notify_exit)) {
          await tx.alert.create({ data: { ...base, geofence_id: BigInt(fence.id), alert_type: "geofence_exit", title: `Left geofence: ${fence.name}`, event_data: where } });
        }
      }
    }

    await signal.save(tx, {
      vehicle_id: vehicleId,
      company_id: companyId,
      last_recorded_at: advance || !state ? recordedAt : state.last_recorded_at,
      last_received_at: state && state.last_received_at > receivedAt ? state.last_received_at : receivedAt,
      last_latitude: advance || !state ? loc.latitude : state.last_latitude,
      last_longitude: advance || !state ? loc.longitude : state.last_longitude,
      inside_geofence_ids: advance ? inside.map(BigInt) : state?.inside_geofence_ids ?? [],
      baseline_set: Boolean(state?.baseline_set) || advance,
      offline_alerted: false, // it just reported, so the next silence is a new episode
    });
  });
}
