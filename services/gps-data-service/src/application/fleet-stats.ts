import { parseId } from "@vayro/service-kit";
import { assertHistoryRange, DELAYED_AFTER_MS, GAP_MS, MAX_PLAUSIBLE_KMH } from "../domain/gps";
import * as locations from "../infrastructure/location.repository";
import { prisma } from "../lib/prisma";

// Read-only aggregates for reporting-service. The caller has already decided which company and vehicles it may see.

const MAX_LATEST_ROWS = 5000;
const round = (n: number, digits: number) => Number(n.toFixed(digits));
const iso = (d: Date) => d.toISOString();

// The newest point of every vehicle of the company, or only of the given vehicles.
export async function latestByVehicle(companyId: string, vehicleIds?: bigint[]) {
  const rows = await locations.latestPerVehicle(prisma, parseId(companyId), vehicleIds, MAX_LATEST_ROWS);
  return rows.map((r) => ({
    vehicle_id: String(r.vehicle_id),
    latitude: r.latitude,
    longitude: r.longitude,
    speed_kmh: r.speed_kmh,
    recorded_at: iso(r.recorded_at),
    received_at: iso(r.received_at),
  }));
}

// Per vehicle: points, approximate distance, speeds, gaps, abnormal and late points over the window (max 31 days).
// Vehicles with no point in the window are simply absent: the caller knows which vehicles exist.
export async function vehicleStats(companyId: string, from: Date, to: Date, vehicleIds?: bigint[]) {
  assertHistoryRange(from, to);
  const rows = await locations.windowStatsPerVehicle(prisma, parseId(companyId), from, to, vehicleIds, { maxKmh: MAX_PLAUSIBLE_KMH, gapSeconds: GAP_MS / 1000, lateSeconds: DELAYED_AFTER_MS / 1000 });
  return rows.map((r) => ({
    vehicle_id: String(r.vehicle_id),
    points: r.points,
    distance_km: round(r.distance_km, 3),
    avg_speed_kmh: r.avg_speed_kmh === null ? null : round(r.avg_speed_kmh, 2),
    max_speed_kmh: r.max_speed_kmh === null ? null : round(r.max_speed_kmh, 2),
    first_recorded_at: iso(r.first_recorded_at),
    last_recorded_at: iso(r.last_recorded_at),
    last_received_at: iso(r.last_received_at),
    gaps: r.gaps,
    anomalies: r.null_island + r.impossible_speed,
    null_island: r.null_island,
    impossible_speed: r.impossible_speed,
    late_points: r.late_points,
  }));
}
