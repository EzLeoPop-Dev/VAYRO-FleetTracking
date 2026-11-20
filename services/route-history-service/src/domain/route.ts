// Pure route rules: no database, no HTTP. Policies below are implementation choices (the PDF gives none).

export const GAP_MS = 10 * 60 * 1000; // same meaning as gps-data-service: two points further apart than this leave a gap
export const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
export const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;
export const PAGE_SIZE = 500; // gps-data-service returns at most this many points per call
export const MAX_PAGES = 10; // so at most 5 000 points per request; beyond that the oldest part of the range is cut and reported as truncated
export const MAX_WINDOWS = 20;

export interface RoutePoint {
  gps_location_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  direction_degree: number | null;
  accuracy_meters: number | null;
  recorded_at: string;
  freshness: string;
  anomalies: string[];
}

const rad = (deg: number) => (deg * Math.PI) / 180;
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// `from`/`to` as the caller gave them: defaults to the last 24 hours. Returns a message when the range is unusable.
export function resolveRange(from: string | undefined, to: string | undefined, now = new Date()): { from: Date; to: Date } | { problem: string } {
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(end.getTime() - DEFAULT_RANGE_MS);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { problem: "from and to must be valid date-times" };
  if (start > end || end.getTime() - start.getTime() > MAX_RANGE_MS) return { problem: "Route range must be ordered and no longer than 31 days" };
  return { from: start, to: end };
}

export interface Window { from: Date; to: Date }
// The stretches of the asked range during which a driver was on a job: each job window cut to the range,
// overlapping or touching ones merged, oldest first. ended_at null means the job is still running.
export function clipWindows(range: Window, jobs: { started_at: string; ended_at: string | null }[], now = new Date()): Window[] {
  const cut = jobs
    .map((job) => ({ from: new Date(Math.max(new Date(job.started_at).getTime(), range.from.getTime())), to: new Date(Math.min(job.ended_at ? new Date(job.ended_at).getTime() : now.getTime(), range.to.getTime())) }))
    .filter((w) => w.from.getTime() <= w.to.getTime())
    .sort((a, b) => a.from.getTime() - b.from.getTime());
  const merged: Window[] = [];
  for (const w of cut) {
    const last = merged[merged.length - 1];
    if (last && w.from.getTime() <= last.to.getTime()) last.to = new Date(Math.max(last.to.getTime(), w.to.getTime()));
    else merged.push({ ...w });
  }
  return merged.slice(0, MAX_WINDOWS);
}

// gps-data-service answers with the newest PAGE_SIZE points of a range. To read a longer range, ask again for the part before the
// oldest point received, until a page is not full, nothing new arrives, or MAX_PAGES is reached.
export function nextPageEnd(page: RoutePoint[], seen: Set<string>): Date | null {
  if (page.length < PAGE_SIZE) return null;
  const fresh = page.filter((p) => !seen.has(p.gps_location_id));
  if (fresh.length === 0) return null; // more than a page of points share one timestamp: cannot move further back
  return new Date(page[0]!.recorded_at); // inclusive: points with this exact timestamp may continue on the next page; duplicates are dropped
}

// Pages come newest first; the result is oldest first, without duplicates.
export function mergePages(pages: RoutePoint[][]): RoutePoint[] {
  const byId = new Map<string, RoutePoint>();
  for (const page of pages) for (const p of page) byId.set(p.gps_location_id, p);
  return [...byId.values()].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.gps_location_id.localeCompare(b.gps_location_id, "en", { numeric: true }));
}

export interface RouteSummary {
  point_count: number;
  first_recorded_at: string | null;
  last_recorded_at: string | null;
  duration_minutes: number;
  distance_km: number;
  distance_note: string;
  skipped_legs: number;
  max_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  gaps: { from: string; to: string; minutes: number }[];
  anomalies: { null_island: number; impossible_speed: number };
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

// Distance is the straight line between consecutive points, so it is approximate (it cuts corners, and it ignores
// the road during a gap). A leg touching a flagged (abnormal) point is skipped and counted instead of inflating the total.
export function summarize(points: RoutePoint[]): RouteSummary {
  const ordered = points; // already oldest first
  let distance = 0, skipped = 0;
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]!, b = ordered[i]!;
    if (a.anomalies.length > 0 || b.anomalies.length > 0) skipped++;
    else distance += distanceKm(a, b);
  }
  const clean = ordered.filter((p) => p.anomalies.length === 0);
  const speeds = clean.map((p) => p.speed_kmh).filter((s): s is number => typeof s === "number");
  const gaps: RouteSummary["gaps"] = [];
  for (let i = 1; i < ordered.length; i++) {
    const ms = new Date(ordered[i]!.recorded_at).getTime() - new Date(ordered[i - 1]!.recorded_at).getTime();
    if (ms > GAP_MS) gaps.push({ from: ordered[i - 1]!.recorded_at, to: ordered[i]!.recorded_at, minutes: Math.round(ms / 60_000) });
  }
  const first = ordered[0]?.recorded_at ?? null, last = ordered[ordered.length - 1]?.recorded_at ?? null;
  return {
    point_count: ordered.length,
    first_recorded_at: first,
    last_recorded_at: last,
    duration_minutes: first && last ? Math.round((new Date(last).getTime() - new Date(first).getTime()) / 60_000) : 0,
    distance_km: round(distance, 3),
    distance_note: "Approximate: straight lines between stored points; legs touching abnormal points are skipped",
    skipped_legs: skipped,
    max_speed_kmh: speeds.length ? Math.max(...speeds) : null,
    avg_speed_kmh: speeds.length ? round(speeds.reduce((s, v) => s + v, 0) / speeds.length, 2) : null, // mean of the speeds the source reported
    gaps,
    anomalies: {
      null_island: ordered.filter((p) => p.anomalies.includes("null_island")).length,
      impossible_speed: ordered.filter((p) => p.anomalies.includes("impossible_speed")).length,
    },
  };
}
