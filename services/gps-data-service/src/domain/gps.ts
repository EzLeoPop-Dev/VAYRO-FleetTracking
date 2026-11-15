import { ApiError } from "@vayro/service-kit";

// Pure GPS rules: no database, no HTTP.

export const DELAYED_AFTER_MS = 5 * 60 * 1000;
export const ALLOWED_CLOCK_SKEW_MS = 30 * 1000;
export const MAX_HISTORY_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

// Implementation policies (the PDF asks to detect missing and abnormal data but gives no thresholds).
export const GAP_MS = 10 * 60 * 1000; // two stored points further apart than this leave a gap
export const MAX_PLAUSIBLE_KMH = 250; // moving between two points faster than this is not a real road vehicle

export type Freshness = "current" | "delayed";
// null_island: exactly (0, 0), the usual "no fix" value. impossible_speed: the move from the previous point needs more than MAX_PLAUSIBLE_KMH.
export type Anomaly = "null_island" | "impossible_speed";
export interface Fix { latitude: number; longitude: number; recordedAt: Date }

const rad = (deg: number) => (deg * Math.PI) / 180;
export function distanceKm(a: Pick<Fix, "latitude" | "longitude">, b: Pick<Fix, "latitude" | "longitude">) {
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Abnormal data is flagged, never dropped: a real vehicle may have a bad fix, and the user decides what to do with it.
// `previous` is the stored point just before this one in time (recorded_at order).
export function anomaliesOf(point: Fix, previous?: Fix | null): Anomaly[] {
  const found: Anomaly[] = [];
  if (point.latitude === 0 && point.longitude === 0) found.push("null_island");
  const hours = previous ? (point.recordedAt.getTime() - previous.recordedAt.getTime()) / 3_600_000 : 0;
  if (previous && hours > 0 && distanceKm(previous, point) / hours > MAX_PLAUSIBLE_KMH) found.push("impossible_speed");
  return found;
}

export interface Gap { from: string; to: string; minutes: number }
// Missing data: places in a time-ordered list of points where nothing was received for longer than GAP_MS.
export function findGaps(recordedAt: Date[]): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 1; i < recordedAt.length; i++) {
    const ms = recordedAt[i]!.getTime() - recordedAt[i - 1]!.getTime();
    if (ms > GAP_MS) gaps.push({ from: recordedAt[i - 1]!.toISOString(), to: recordedAt[i]!.toISOString(), minutes: Math.round(ms / 60_000) });
  }
  return gaps;
}

// Old points (or clocks far ahead of the server) are flagged, never silently trusted as "current".
export function freshness(recordedAt: Date): Freshness {
  const age = Date.now() - recordedAt.getTime();
  return age > DELAYED_AFTER_MS || age < -ALLOWED_CLOCK_SKEW_MS ? "delayed" : "current";
}

export function assertNotInFuture(recordedAt: Date) {
  if (recordedAt.getTime() > Date.now() + ALLOWED_CLOCK_SKEW_MS) throw new ApiError(422, "VALIDATION_ERROR", "recorded_at is too far in the future");
}

export function assertHistoryRange(from: Date, to: Date) {
  if (from > to || to.getTime() - from.getTime() > MAX_HISTORY_RANGE_MS) throw new ApiError(422, "VALIDATION_ERROR", "History range must be ordered and no longer than 31 days");
}

// A driver's phone may report only for the vehicle assigned to them, while a job of theirs is in progress.
export function assertDriverMayReport(input: { sourceType: string; driverId: string; vehicle: { current_driver_id: string | null; vehicle_status: string }; hasActiveJob: boolean }) {
  const { sourceType, driverId, vehicle, hasActiveJob } = input;
  if (sourceType !== "driver_mobile_app" || vehicle.current_driver_id !== driverId || vehicle.vehicle_status !== "active" || !hasActiveJob) {
    throw new ApiError(403, "FORBIDDEN", "Driver requires an assigned vehicle and active transport job");
  }
}
