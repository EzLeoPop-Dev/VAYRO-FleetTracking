// Pure alert rules: no database, no HTTP. Thresholds below are implementation policies (the PDF gives none).

export const OVERSPEED_COOLDOWN_MS = 10 * 60 * 1000; // no second overspeed alert for a vehicle while one is still open and this recent
export const ANOMALY_COOLDOWN_MS = 10 * 60 * 1000;
export const OFFLINE_COOLDOWN_MS = 60 * 60 * 1000;
export const OFFLINE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // a vehicle silent for longer than this is retired, not "offline"

export type RuleType = "gps_offline" | "overspeed";
export type AlertStatus = "unread" | "read" | "handling" | "resolved";
export type AlertAction = "read" | "handling" | "resolve";

// gps_offline: minutes without data. overspeed: km/h. Returns a message when the value is unusable.
export function thresholdProblem(type: RuleType, value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return "threshold_value is required";
  if (type === "gps_offline") return value >= 1 && value <= 1440 ? null : "gps_offline threshold must be between 1 and 1440 minutes";
  return value > 0 && value <= 400 ? null : "overspeed threshold must be above 0 and at most 400 km/h";
}

const rad = (deg: number) => (deg * Math.PI) / 180;
export interface LatLon { latitude: number; longitude: number }

// Great-circle distance in meters (haversine).
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Fence { id: string; name: string; latitude: number; longitude: number; radius_meters: number; notify_enter: boolean; notify_exit: boolean }
export const isInside = (fence: Fence, point: LatLon) => distanceMeters(fence, point) <= fence.radius_meters;

// Which active geofences contain the point now, and which of them the vehicle just entered or left.
// `previous` is the set of fence ids it was inside at its last usable point. A fence that is no longer active
// (deleted, switched off) is never reported as left: the vehicle did not go anywhere.
export function geofenceTransitions(previous: readonly string[], fences: readonly Fence[], point: LatLon) {
  const before = new Set(previous);
  const inside: string[] = [];
  const entered: Fence[] = [];
  const exited: Fence[] = [];
  for (const fence of fences) {
    const now = isInside(fence, point);
    if (now) inside.push(fence.id);
    if (now && !before.has(fence.id)) entered.push(fence);
    if (!now && before.has(fence.id)) exited.push(fence);
  }
  return { inside, entered, exited };
}

// A point may raise alerts only when it is current and not flagged abnormal by gps-data-service.
export const isUsablePoint = (p: { freshness: string; anomalies: readonly string[] }) => p.freshness === "current" && p.anomalies.length === 0;

export const exceedsSpeed = (speedKmh: number | null | undefined, thresholdKmh: number) => typeof speedKmh === "number" && speedKmh > thresholdKmh;

// Offline when nothing was received for `minutes` or more and the vehicle has not been silent so long it is retired.
export function isOffline(lastReceivedAt: Date, now: Date, minutes: number): boolean {
  const silent = now.getTime() - lastReceivedAt.getTime();
  return silent >= minutes * 60_000 && silent <= OFFLINE_LOOKBACK_MS;
}

// unread -> read -> handling -> resolved. "read" never moves an alert backwards; handling and resolve are refused once resolved.
const FROM: Record<AlertAction, readonly AlertStatus[]> = {
  read: ["unread"],
  handling: ["unread", "read"],
  resolve: ["unread", "read", "handling"],
};
export const canApply = (status: AlertStatus, action: AlertAction) => FROM[action].includes(status);
export const NEXT: Record<AlertAction, AlertStatus> = { read: "read", handling: "handling", resolve: "resolved" };
