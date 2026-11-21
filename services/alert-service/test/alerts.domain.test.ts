import { describe, expect, test } from "bun:test";
import { canApply, distanceMeters, exceedsSpeed, geofenceTransitions, isOffline, isUsablePoint, thresholdProblem, type Fence } from "../src/domain/alerts";

const fence = (id: string, lat: number, lon: number, radius: number, extra: Partial<Fence> = {}): Fence => ({ id, name: `F${id}`, latitude: lat, longitude: lon, radius_meters: radius, notify_enter: true, notify_exit: true, ...extra });

describe("distance", () => {
  test("zero for the same point, about 111 km per degree of latitude", () => {
    expect(distanceMeters({ latitude: 13.75, longitude: 100.5 }, { latitude: 13.75, longitude: 100.5 })).toBe(0);
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111195, -2);
  });
  test("Bangkok to Chiang Mai is roughly 580 km", () => {
    const d = distanceMeters({ latitude: 13.7563, longitude: 100.5018 }, { latitude: 18.7883, longitude: 98.9853 }) / 1000;
    expect(d).toBeGreaterThan(570);
    expect(d).toBeLessThan(590);
  });
});

describe("geofence transitions", () => {
  const home = fence("1", 13.75, 100.5, 500);
  const near = { latitude: 13.7501, longitude: 100.5001 }; // about 15 m away
  const far = { latitude: 13.8, longitude: 100.6 };
  test("entering reports an enter and the new inside set", () => {
    const r = geofenceTransitions([], [home], near);
    expect(r.inside).toEqual(["1"]);
    expect(r.entered.map((f) => f.id)).toEqual(["1"]);
    expect(r.exited).toEqual([]);
  });
  test("staying inside reports nothing new", () => {
    const r = geofenceTransitions(["1"], [home], near);
    expect(r.entered).toEqual([]);
    expect(r.exited).toEqual([]);
    expect(r.inside).toEqual(["1"]);
  });
  test("leaving reports an exit", () => {
    const r = geofenceTransitions(["1"], [home], far);
    expect(r.exited.map((f) => f.id)).toEqual(["1"]);
    expect(r.inside).toEqual([]);
  });
  test("a geofence that is no longer active is dropped silently, not reported as left", () => {
    const r = geofenceTransitions(["1", "2"], [fence("2", 13.75, 100.5, 500)], near);
    expect(r.exited).toEqual([]);
    expect(r.inside).toEqual(["2"]);
  });
  test("overlapping fences are tracked independently", () => {
    const r = geofenceTransitions(["1"], [home, fence("2", 13.75, 100.5, 5000)], near);
    expect(r.entered.map((f) => f.id)).toEqual(["2"]);
    expect(r.inside).toEqual(["1", "2"]);
  });
  test("the boundary counts as inside", () => {
    const edge = { latitude: 0, longitude: 0 };
    expect(geofenceTransitions([], [fence("1", 0, 0, 0)], edge).inside).toEqual(["1"]);
  });
});

describe("point usability and speed", () => {
  test("only current, non-abnormal points raise alerts", () => {
    expect(isUsablePoint({ freshness: "current", anomalies: [] })).toBe(true);
    expect(isUsablePoint({ freshness: "delayed", anomalies: [] })).toBe(false);
    expect(isUsablePoint({ freshness: "current", anomalies: ["impossible_speed"] })).toBe(false);
  });
  test("missing speed never counts as speeding; equal to the limit is not over it", () => {
    expect(exceedsSpeed(null, 90)).toBe(false);
    expect(exceedsSpeed(undefined, 90)).toBe(false);
    expect(exceedsSpeed(90, 90)).toBe(false);
    expect(exceedsSpeed(90.01, 90)).toBe(true);
  });
});

describe("thresholds", () => {
  test("gps_offline is minutes in 1..1440, overspeed is km/h in (0, 400]", () => {
    expect(thresholdProblem("gps_offline", 5)).toBeNull();
    expect(thresholdProblem("gps_offline", 0)).not.toBeNull();
    expect(thresholdProblem("gps_offline", 1441)).not.toBeNull();
    expect(thresholdProblem("overspeed", 90)).toBeNull();
    expect(thresholdProblem("overspeed", 0)).not.toBeNull();
    expect(thresholdProblem("overspeed", 401)).not.toBeNull();
    expect(thresholdProblem("overspeed", null)).not.toBeNull();
  });
});

describe("offline check", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  test("offline once silent for the threshold, not before", () => {
    expect(isOffline(new Date("2026-11-18T11:56:00Z"), now, 5)).toBe(false);
    expect(isOffline(new Date("2026-11-18T11:55:00Z"), now, 5)).toBe(true);
  });
  test("a vehicle silent for over a week is retired, not offline", () => {
    expect(isOffline(new Date("2026-11-10T12:00:00Z"), now, 5)).toBe(false);
  });
});

describe("alert status changes", () => {
  test("read only moves unread forward", () => {
    expect(canApply("unread", "read")).toBe(true);
    expect(canApply("read", "read")).toBe(false);
    expect(canApply("handling", "read")).toBe(false);
  });
  test("handling and resolve are refused once resolved", () => {
    expect(canApply("resolved", "handling")).toBe(false);
    expect(canApply("resolved", "resolve")).toBe(false);
    expect(canApply("handling", "resolve")).toBe(true);
    expect(canApply("unread", "resolve")).toBe(true);
  });
});
