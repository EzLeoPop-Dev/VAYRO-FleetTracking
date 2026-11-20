import { describe, expect, test } from "bun:test";
import { clipWindows, mergePages, nextPageEnd, PAGE_SIZE, resolveRange, summarize, type RoutePoint } from "../src/domain/route";

const point = (id: number, at: string, lat: number, lon: number, extra: Partial<RoutePoint> = {}): RoutePoint => ({
  gps_location_id: String(id), latitude: lat, longitude: lon, speed_kmh: null, direction_degree: null, accuracy_meters: null, recorded_at: at, freshness: "current", anomalies: [], ...extra,
});

describe("range", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  test("defaults to the last 24 hours", () => {
    const r = resolveRange(undefined, undefined, now) as { from: Date; to: Date };
    expect(r.to.toISOString()).toBe("2026-11-18T12:00:00.000Z");
    expect(r.from.toISOString()).toBe("2026-11-17T12:00:00.000Z");
  });
  test("rejects reversed and over-long ranges", () => {
    expect("problem" in resolveRange("2026-11-18T12:00:00Z", "2026-11-18T11:00:00Z", now)).toBe(true);
    expect("problem" in resolveRange("2026-10-01T00:00:00Z", "2026-11-18T00:00:00Z", now)).toBe(true);
    expect("problem" in resolveRange("2026-11-01T00:00:00Z", "2026-11-18T00:00:00Z", now)).toBe(false);
  });
});

describe("summary", () => {
  test("an empty route is all zeros, not an error", () => {
    const s = summarize([]);
    expect(s.point_count).toBe(0);
    expect(s.distance_km).toBe(0);
    expect(s.first_recorded_at).toBeNull();
    expect(s.max_speed_kmh).toBeNull();
  });
  test("distance adds up straight-line legs: one degree of latitude is about 111 km", () => {
    const s = summarize([point(1, "2026-11-18T10:00:00Z", 0, 0), point(2, "2026-11-18T10:05:00Z", 0.5, 0), point(3, "2026-11-18T10:10:00Z", 1, 0)]);
    expect(s.distance_km).toBeCloseTo(111.195, 1);
    expect(s.duration_minutes).toBe(10);
    expect(s.gaps).toEqual([]);
  });
  test("legs touching abnormal points are skipped and counted, not added", () => {
    const s = summarize([
      point(1, "2026-11-18T10:00:00Z", 13.75, 100.5),
      point(2, "2026-11-18T10:01:00Z", 0, 0, { anomalies: ["null_island"] }),
      point(3, "2026-11-18T10:02:00Z", 13.76, 100.5),
    ]);
    expect(s.skipped_legs).toBe(2);
    expect(s.distance_km).toBe(0);
    expect(s.anomalies.null_island).toBe(1);
  });
  test("speeds come from clean points only; missing speeds are ignored", () => {
    const s = summarize([
      point(1, "2026-11-18T10:00:00Z", 13.75, 100.5, { speed_kmh: 40 }),
      point(2, "2026-11-18T10:01:00Z", 13.751, 100.5),
      point(3, "2026-11-18T10:02:00Z", 13.752, 100.5, { speed_kmh: 80 }),
      point(4, "2026-11-18T10:03:00Z", 20, 100.5, { speed_kmh: 999, anomalies: ["impossible_speed"] }),
    ]);
    expect(s.max_speed_kmh).toBe(80);
    expect(s.avg_speed_kmh).toBe(60);
  });
  test("a silence longer than ten minutes is reported as a gap", () => {
    const s = summarize([point(1, "2026-11-18T10:00:00Z", 13.75, 100.5), point(2, "2026-11-18T10:30:00Z", 13.76, 100.5)]);
    expect(s.gaps).toEqual([{ from: "2026-11-18T10:00:00Z", to: "2026-11-18T10:30:00Z", minutes: 30 }]);
  });
});

describe("paging back through a long range", () => {
  const page = (from: number, count: number) => Array.from({ length: count }, (_, i) => point(from + i, new Date(Date.UTC(2026, 10, 18, 0, from + i)).toISOString(), 13.75, 100.5));
  test("a short page ends the walk", () => {
    expect(nextPageEnd(page(1, 10), new Set())).toBeNull();
  });
  test("a full page continues from its oldest point", () => {
    const full = page(1000, PAGE_SIZE);
    expect(nextPageEnd(full, new Set())!.toISOString()).toBe(full[0]!.recorded_at);
  });
  test("a full page with nothing new stops the walk instead of looping", () => {
    const full = page(1000, PAGE_SIZE);
    expect(nextPageEnd(full, new Set(full.map((p) => p.gps_location_id)))).toBeNull();
  });
  test("merging overlapping pages drops duplicates and sorts oldest first", () => {
    const newer = page(5, 4), older = page(3, 4); // ids 5-8 and 3-6 overlap on 5 and 6
    const merged = mergePages([newer, older]);
    expect(merged.map((p) => p.gps_location_id)).toEqual(["3", "4", "5", "6", "7", "8"]);
  });
});

describe("driver job windows", () => {
  const range = { from: new Date("2026-11-18T00:00:00Z"), to: new Date("2026-11-18T23:00:00Z") };
  const now = new Date("2026-11-18T12:00:00Z");
  test("each job is cut to the asked range", () => {
    const w = clipWindows(range, [{ started_at: "2026-11-17T22:00:00Z", ended_at: "2026-11-18T03:00:00Z" }], now);
    expect(w.map((x) => [x.from.toISOString(), x.to.toISOString()])).toEqual([["2026-11-18T00:00:00.000Z", "2026-11-18T03:00:00.000Z"]]);
  });
  test("a running job lasts until now (or the end of the range, whichever is earlier)", () => {
    const w = clipWindows(range, [{ started_at: "2026-11-18T10:00:00Z", ended_at: null }], now);
    expect(w[0]!.to.toISOString()).toBe("2026-11-18T12:00:00.000Z");
  });
  test("overlapping windows merge and jobs outside the range disappear", () => {
    const w = clipWindows(range, [
      { started_at: "2026-11-18T01:00:00Z", ended_at: "2026-11-18T03:00:00Z" },
      { started_at: "2026-11-18T02:00:00Z", ended_at: "2026-11-18T05:00:00Z" },
      { started_at: "2026-11-10T01:00:00Z", ended_at: "2026-11-10T03:00:00Z" },
    ], now);
    expect(w).toHaveLength(1);
    expect(w[0]!.to.toISOString()).toBe("2026-11-18T05:00:00.000Z");
  });
  test("a driver with no jobs sees nothing", () => {
    expect(clipWindows(range, [], now)).toEqual([]);
  });
});
