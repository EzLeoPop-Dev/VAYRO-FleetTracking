// Runs the real reporting-service code (routes, roles, reports, CSV) with the other services replaced by fakes.
// No database and no other service needed: reporting-service stores nothing.
import { describe, expect, test } from "bun:test";
import { ApiError, type Caller } from "@vayro/service-kit";
import { createReportingApp } from "../src/app";
import type { AlertRow, DeviceRow, GpsVehicleStat, JobRow, LatestPoint, Sources, VehicleRow } from "../src/adapters/sources";
import { toCsv } from "../src/domain/csv";
import { companyFor, gpsStatus, parseRange } from "../src/domain/rules";

const NOW = new Date("2026-11-17T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const A = "1001", B = "1002";

// ---- people ----
const caller = (token: string, role: Caller["role"], company: string | null): [string, Caller] =>
  [token, { role, company_id: company, user_id: token, full_name: token, email: `${token}@example.test`, phone: null, account_status: "active", workspace_status: "active" }];
const people = new Map<string, Caller>([
  caller("platform", "platform_admin", null), caller("admin-a", "company_admin", A), caller("dispatcher-a", "dispatcher", A), caller("driver-a", "driver", A), caller("admin-b", "company_admin", B),
]);
const resolveUser = async (authorization?: string | null) => {
  const user = people.get(authorization?.match(/^Bearer (\S+)$/i)?.[1] ?? "");
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Missing or invalid access token");
  return user;
};

// ---- data of company A (three vehicles); company B has none ----
const vehicle = (n: number, status = "active", code = `V${n}`): VehicleRow => ({ vehicle_id: String(n), vehicle_code: code, license_plate: `PLATE-${n}`, vehicle_type: "Truck", vehicle_status: status, current_driver_id: null });
let vehicleData: VehicleRow[] = [vehicle(1), vehicle(2, "maintenance"), vehicle(3)];
const latest: LatestPoint[] = [
  { vehicle_id: "1", latitude: 13.7, longitude: 100.5, speed_kmh: 40, recorded_at: ago(3), received_at: ago(2) },   // current
  { vehicle_id: "2", latitude: 13.8, longitude: 100.6, speed_kmh: 0, recorded_at: ago(100), received_at: ago(90) },  // delayed
];                                                                                                                      // vehicle 3: no data
const devices: DeviceRow[] = [
  { gps_device_id: "9", vehicle_id: "1", device_code: "dev-1", source_type: "gps_device", connection_status: "connected", last_received_at: ago(2), disabled: false },
  { gps_device_id: "10", vehicle_id: "2", device_code: "dev-2", source_type: "provider_api", connection_status: "disconnected", last_received_at: ago(90), disabled: false },
];
const gpsStat = (id: string, o: Partial<GpsVehicleStat> = {}): GpsVehicleStat => ({
  vehicle_id: id, points: 10, distance_km: 12.3456, avg_speed_kmh: 35, max_speed_kmh: 80, first_recorded_at: ago(600), last_recorded_at: ago(3), last_received_at: ago(2), gaps: 1, anomalies: 2, null_island: 1, impossible_speed: 1, late_points: 3, ...o,
});
const job = (n: number, status: string): JobRow => ({ job_id: String(n), job_code: `J${n}`, job_name: null, job_status: status, pickup_address: "A, B", delivery_address: "C", vehicle_id: "1", driver_id: "5", scheduled_start_at: null, scheduled_end_at: null, actual_start_at: null, actual_end_at: null, created_at: ago(60), duration_minutes: null, has_problem: false });
const alert = (n: number, status: string): AlertRow => ({ alert_id: String(n), alert_type: "overspeed", title: `Alert ${n}`, alert_status: status, vehicle_id: "1", job_id: null, geofence_id: null, triggered_at: ago(30), handled_by: null, resolved_at: null, resolution_minutes: null });

// ---- fake sources that remember every call ----
function fakeSources(over: Partial<Sources> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const rec = <F extends (...a: any[]) => any>(method: string, fn: F) => ((...args: Parameters<F>) => { calls.push({ method, args }); return fn(...args); }) as F;
  const only = (company: string | undefined) => company === A;
  const sources: Sources = {
    companyStats: rec("companyStats", async () => ({ total: 5, by_status: { pending: 1, active: 3, suspended: 1, rejected: 0 } })),
    userStats: rec("userStats", async (c?: string) => ({ total: c ? 4 : 40, by_role: { platform_admin: 0, company_admin: 1, dispatcher: 1, driver: 2 }, by_status: { active: 4, inactive: 0, suspended: 0 } })),
    vehicleStats: rec("vehicleStats", async (c?: string) => (only(c) ? { total: 3, by_status: { active: 2, inactive: 0, maintenance: 1 }, with_driver: 0 } : { total: 0, by_status: { active: 0, inactive: 0, maintenance: 0 }, with_driver: 0 })),
    vehicles: rec("vehicles", async (c: string, q: { status?: string; vehicleId?: string; limit: number; offset: number }) => {
      const rows = (only(c) ? vehicleData : []).filter((v) => (!q.status || v.vehicle_status === q.status) && (!q.vehicleId || v.vehicle_id === q.vehicleId));
      return { total: rows.length, rows: rows.slice(q.offset, q.offset + q.limit) };
    }),
    deviceStats: rec("deviceStats", async () => ({ total: 2, by_connection_status: { connected: 1, disconnected: 1, error: 0 }, disabled: 0 })),
    devices: rec("devices", async (_c: string, ids: string[]) => devices.filter((d) => ids.includes(d.vehicle_id))),
    latestByVehicle: rec("latestByVehicle", async (c: string, ids?: string[]) => (only(c) ? latest.filter((p) => !ids || ids.includes(p.vehicle_id)) : [])),
    gpsStats: rec("gpsStats", async (c: string, _f: Date, _t: Date, ids?: string[]) => (only(c) ? [gpsStat("1"), gpsStat("2", { points: 5, distance_km: 1, anomalies: 0, gaps: 0, late_points: 0 })].filter((s) => !ids || ids.includes(s.vehicle_id)) : [])),
    jobStats: rec("jobStats", async () => ({ total: 3, by_status: { pending: 1, assigned: 0, in_progress: 1, completed: 1, cancelled: 0, problem: 0 }, avg_duration_minutes: 95 })),
    jobs: rec("jobs", async (_c: string, q: { limit: number; offset: number }) => ({ total: 3, rows: [job(1, "pending"), job(2, "in_progress"), job(3, "completed")].slice(q.offset, q.offset + q.limit) })),
    alertStats: rec("alertStats", async () => ({ total: 2, by_type: { gps_offline: 0, overspeed: 2, geofence_enter: 0, geofence_exit: 0, system_anomaly: 0, job_assignment: 0 }, by_status: { unread: 1, read: 0, handling: 0, resolved: 1 }, open_total: 4, avg_resolution_minutes: 20 })),
    alerts: rec("alerts", async (_c: string, q: { limit: number; offset: number }) => ({ total: 2, rows: [alert(1, "unread"), alert(2, "resolved")].slice(q.offset, q.offset + q.limit) })),
    ...over,
  };
  return { sources, calls };
}

function appWith(sources: Sources) {
  return createReportingApp({ sources, resolveUser, clock: () => NOW }).compile();
}
async function get(app: ReturnType<typeof appWith>, path: string, token?: string) {
  const response = await app.handle(new Request(`http://localhost${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }));
  const type = response.headers.get("content-type") ?? "";
  return { status: response.status, response, json: type.includes("json") ? await response.json() : null, text: type.includes("json") ? "" : await response.text() };
}
const downFor = (what: string) => async () => { throw new ApiError(503, "UPSTREAM_UNAVAILABLE", `${what} down`); };

describe("pure rules", () => {
  test("GPS status comes from when data was last received", () => {
    expect(gpsStatus(ago(4), NOW)).toBe("current");
    expect(gpsStatus(ago(6), NOW)).toBe("delayed");
    expect(gpsStatus(null, NOW)).toBe("no_data");
    expect(gpsStatus(undefined, NOW)).toBe("no_data");
  });
  test("the company comes from the signed-in user", () => {
    expect(companyFor(people.get("admin-a")!, undefined)).toBe(A);
    expect(companyFor(people.get("admin-a")!, A)).toBe(A);
    expect(() => companyFor(people.get("admin-a")!, B)).toThrow();
    expect(() => companyFor(people.get("platform")!, undefined)).toThrow();
    expect(companyFor(people.get("platform")!, B)).toBe(B);
  });
  test("periods: defaults, ordering and the 31 day limit", () => {
    const d = parseRange(undefined, undefined, 1, NOW);
    expect(NOW.getTime() - d.from.getTime()).toBe(24 * 3600_000);
    expect(() => parseRange("2026-11-10T00:00:00Z", "2026-11-01T00:00:00Z", 1, NOW)).toThrow();
    expect(() => parseRange("2026-10-01T00:00:00Z", "2026-11-17T00:00:00Z", 1, NOW)).toThrow();
    expect(parseRange("2026-10-18T00:00:00Z", "2026-11-17T00:00:00Z", 1, NOW).from).toBeInstanceOf(Date);
  });
  test("CSV: quoting, BOM, and spreadsheet formulas are neutralised", () => {
    const csv = toCsv<{ a: string | number | null }>([{ header: "a", value: (r) => r.a }], [{ a: "x,y" }, { a: 'say "hi"' }, { a: "=SUM(A1)" }, { a: "+1" }, { a: "@cmd" }, { a: -5 }, { a: null }, { a: "line\nbreak" }]);
    expect(csv.startsWith("﻿a\r\n")).toBe(true);
    expect(csv).toContain('"x,y"'); expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain("'=SUM(A1)"); expect(csv).toContain("'+1"); expect(csv).toContain("'@cmd");
    expect(csv).toContain("\r\n-5\r\n"); // a real number stays a number
    expect(csv).toContain('"line\nbreak"');
  });
});

describe("who may call what", () => {
  const { sources } = fakeSources();
  const app = appWith(sources);
  test("no token is 401; a driver is 403 everywhere", async () => {
    for (const path of ["/api/v1/dashboard/company", "/api/v1/reports/vehicles", "/api/v1/reports/jobs"]) {
      expect((await get(app, path)).status).toBe(401);
      expect((await get(app, path, "driver-a")).status).toBe(403);
    }
  });
  test("the platform dashboard is for the Platform Admin only", async () => {
    expect((await get(app, "/api/v1/dashboard/platform", "platform")).status).toBe(200);
    expect((await get(app, "/api/v1/dashboard/platform", "admin-a")).status).toBe(403);
    expect((await get(app, "/api/v1/dashboard/platform", "dispatcher-a")).status).toBe(403);
  });
  test("a company user cannot ask about another company; a Platform Admin must name one", async () => {
    expect((await get(app, `/api/v1/dashboard/company?company_id=${B}`, "admin-a")).status).toBe(403);
    expect((await get(app, `/api/v1/reports/vehicles?company_id=${B}`, "dispatcher-a")).status).toBe(403);
    expect((await get(app, "/api/v1/dashboard/company", "platform")).status).toBe(422);
    expect((await get(app, "/api/v1/reports/gps", "platform")).status).toBe(422);
    expect((await get(app, `/api/v1/reports/vehicles?company_id=${A}`, "platform")).status).toBe(200);
  });
  test("every query to the other services uses the company of the signed-in user", async () => {
    const { sources: s, calls } = fakeSources();
    const a = appWith(s);
    await get(a, `/api/v1/reports/vehicles?company_id=${A}`, "admin-a");
    await get(a, "/api/v1/reports/jobs", "dispatcher-a");
    await get(a, "/api/v1/dashboard/company", "admin-a");
    const companies = calls.flatMap((c) => (typeof c.args[0] === "string" && c.method !== "devices" ? [c.args[0]] : []));
    expect(companies.length).toBeGreaterThan(5);
    expect(new Set(companies)).toEqual(new Set([A]));
    expect((await get(a, "/api/v1/reports/vehicles?company_id=abc", "platform")).status).toBe(422);
  });
});

describe("dashboards", () => {
  test("platform overview: every section, nothing about one company's people", async () => {
    const r = await get(appWith(fakeSources().sources), "/api/v1/dashboard/platform?days=7", "platform");
    const d = r.json.data;
    expect(r.status).toBe(200); expect(d.window.days).toBe(7);
    expect(d.companies).toMatchObject({ available: true, total: 5, by_status: { active: 3 } });
    for (const key of ["users", "vehicles", "gps_devices", "jobs", "alerts"]) expect(d[key].available).toBe(true);
    expect(d.alerts.open_total).toBe(4);
  });
  test("company overview: GPS status is counted from the last received time (current / delayed / no data)", async () => {
    const d = (await get(appWith(fakeSources().sources), "/api/v1/dashboard/company", "admin-a")).json.data;
    expect(d.company_id).toBe(A);
    expect(d.vehicles).toMatchObject({ available: true, total: 3, by_status: { active: 2, maintenance: 1 } });
    expect(d.gps).toEqual({ available: true, vehicles_total: 3, current: 1, delayed: 1, no_data: 1 });
    expect(d.users).toMatchObject({ available: true, total: 4 });
  });
  test("a Dispatcher sees jobs and vehicle status but not the user counts", async () => {
    const d = (await get(appWith(fakeSources().sources), "/api/v1/dashboard/company", "dispatcher-a")).json.data;
    expect(d).not.toHaveProperty("users");
    for (const key of ["vehicles", "gps", "gps_devices", "jobs", "alerts"]) expect(d[key].available).toBe(true);
  });
  test("a source that is down shows as unavailable instead of failing the page or showing a made-up zero", async () => {
    const { sources } = fakeSources({ alertStats: downFor("alert") as Sources["alertStats"], latestByVehicle: downFor("gps") as Sources["latestByVehicle"] });
    const r = await get(appWith(sources), "/api/v1/dashboard/company", "admin-a");
    expect(r.status).toBe(200);
    expect(r.json.data.alerts).toEqual({ available: false, reason: "alert-service is unavailable" });
    expect(r.json.data.gps.available).toBe(false);
    expect(r.json.data.jobs.available).toBe(true);
    expect(r.json.data.vehicles.available).toBe(true);
    const platform = await get(appWith(fakeSources({ companyStats: downFor("company") as Sources["companyStats"] }).sources), "/api/v1/dashboard/platform", "platform");
    expect(platform.json.data.companies.available).toBe(false); expect(platform.json.data.users.available).toBe(true);
  });
  test("the period must be 1 to 31 days", async () => {
    const app = appWith(fakeSources().sources);
    expect((await get(app, "/api/v1/dashboard/company?days=0", "admin-a")).status).toBe(422);
    expect((await get(app, "/api/v1/dashboard/company?days=32", "admin-a")).status).toBe(422);
    expect((await get(app, "/api/v1/dashboard/company?days=31", "admin-a")).status).toBe(200);
  });
});

describe("reports", () => {
  test("vehicles: vehicle, last position, GPS status and devices come together; paging maps to the other service", async () => {
    const { sources, calls } = fakeSources();
    const r = await get(appWith(sources), "/api/v1/reports/vehicles?page=2&limit=2", "admin-a");
    expect(r.status).toBe(200);
    expect(r.json.meta).toMatchObject({ page: 2, limit: 2, total: 3, pages: 2 });
    expect(r.json.data.rows.map((v: any) => v.vehicle_id)).toEqual(["3"]);
    expect(calls.find((c) => c.method === "vehicles")!.args[1]).toMatchObject({ limit: 2, offset: 2 });
    const all = (await get(appWith(fakeSources().sources), "/api/v1/reports/vehicles", "dispatcher-a")).json.data;
    const [v1, v2, v3] = all.rows;
    expect(v1).toMatchObject({ vehicle_code: "V1", gps_status: "current", device_count: 1, devices_connected: 1, latitude: 13.7 });
    expect(v2).toMatchObject({ gps_status: "delayed", devices_connected: 0 });
    expect(v3).toMatchObject({ gps_status: "no_data", last_received_at: null, latitude: null, device_count: 0 });
    expect(all.summary).toMatchObject({ total_matching: 3, fleet_total: 3, fleet_by_status: { maintenance: 1 } });
    expect((await get(appWith(fakeSources().sources), "/api/v1/reports/vehicles?status=maintenance", "admin-a")).json.data.rows.length).toBe(1);
  });
  test("routes: distance and speed per vehicle with an honest summary", async () => {
    const r = await get(appWith(fakeSources().sources), "/api/v1/reports/routes", "admin-a");
    const d = r.json.data;
    expect(r.status).toBe(200);
    expect(d.rows.find((x: any) => x.vehicle_id === "1")).toMatchObject({ points: 10, distance_km: 12.3456, max_speed_kmh: 80 });
    expect(d.rows.find((x: any) => x.vehicle_id === "3")).toMatchObject({ points: 0, distance_km: 0, avg_speed_kmh: null }); // no data stays "none", not invented
    expect(d.summary).toMatchObject({ vehicles_total: 3, vehicles_with_data: 2, total_points: 15, total_distance_km: 13.346, distance_is_approximate: true, complete: true });
    expect((await get(appWith(fakeSources().sources), "/api/v1/reports/routes?vehicle_id=2", "admin-a")).json.data.rows.length).toBe(1);
    expect((await get(appWith(fakeSources().sources), "/api/v1/reports/routes?vehicle_id=999", "admin-a")).status).toBe(404);
  });
  test("periods are checked: not backwards, not longer than 31 days, valid dates", async () => {
    const app = appWith(fakeSources().sources);
    expect((await get(app, "/api/v1/reports/routes?from=2026-11-10T00:00:00Z&to=2026-11-01T00:00:00Z", "admin-a")).status).toBe(422);
    expect((await get(app, "/api/v1/reports/gps?from=2026-09-01T00:00:00Z&to=2026-11-01T00:00:00Z", "admin-a")).status).toBe(422);
    expect((await get(app, "/api/v1/reports/jobs?from=yesterday", "admin-a")).status).toBe(422);
    expect((await get(app, "/api/v1/reports/jobs?limit=201", "admin-a")).status).toBe(422);
    expect((await get(app, "/api/v1/reports/vehicles?limit=101", "admin-a")).status).toBe(422);
    expect((await get(app, "/api/v1/reports/jobs?status=nonsense", "admin-a")).status).toBe(422);
  });
  test("jobs and alerts: the period and filters reach the owning service; summaries come from it", async () => {
    const { sources, calls } = fakeSources();
    const app = appWith(sources);
    const jobs = await get(app, "/api/v1/reports/jobs?status=completed&from=2026-11-01T00:00:00Z&to=2026-11-10T00:00:00Z", "dispatcher-a");
    expect(jobs.json.data.summary).toMatchObject({ total_in_period: 3, avg_duration_minutes: 95, by_status: { completed: 1 } });
    const q = calls.find((c) => c.method === "jobs")!.args[1] as any;
    expect(q.status).toBe("completed"); expect(q.from.toISOString()).toBe("2026-11-01T00:00:00.000Z"); expect(q.to.toISOString()).toBe("2026-11-10T00:00:00.000Z");
    const alerts = await get(app, "/api/v1/reports/alerts?type=overspeed&status=unread", "admin-a");
    expect(alerts.json.data.summary).toMatchObject({ total_in_period: 2, open_total: 4, avg_resolution_minutes: 20, by_type: { overspeed: 2 } });
    expect(calls.find((c) => c.method === "alerts")!.args[1]).toMatchObject({ type: "overspeed", status: "unread" });
    const defaults = (await get(appWith(fakeSources().sources), "/api/v1/reports/jobs", "admin-a")).json.data.summary.period;
    expect(new Date(defaults.to).getTime() - new Date(defaults.from).getTime()).toBe(30 * 24 * 3600_000); // jobs default to 30 days
  });
  test("GPS quality: counts by last-received status, late points, gaps and anomalies", async () => {
    const r = await get(appWith(fakeSources().sources), "/api/v1/reports/gps", "admin-a");
    const d = r.json.data;
    expect(d.summary).toMatchObject({ vehicles_total: 3, vehicles_by_gps_status: { current: 1, delayed: 1, no_data: 1 }, vehicles_without_points_in_period: 1, total_points: 15, late_points: 3, gaps: 1, anomalies: 2, complete: true });
    expect(d.rows[0]).toMatchObject({ vehicle_id: "1", gps_status: "current", points: 10, late_points: 3, gaps: 1, anomalies: 2, devices_connected: 1 });
    expect(d.rows[2]).toMatchObject({ vehicle_id: "3", gps_status: "no_data", points: 0, anomalies: 0 });
  });
  test("a source that is down fails the report clearly (503), never with partly wrong numbers", async () => {
    const r = await get(appWith(fakeSources({ gpsStats: downFor("gps") as Sources["gpsStats"] }).sources), "/api/v1/reports/routes", "admin-a");
    expect(r.status).toBe(503); expect(r.json.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("CSV export", () => {
  test("jobs as CSV: right headers, BOM, download name, every row, no JSON wrapper", async () => {
    const r = await get(appWith(fakeSources().sources), "/api/v1/reports/jobs?format=csv", "admin-a");
    expect(r.status).toBe(200);
    expect(r.response.headers.get("content-type")).toContain("text/csv");
    expect(r.response.headers.get("content-disposition")).toBe('attachment; filename="report-jobs-2026-11-17.csv"');
    expect(r.response.headers.get("cache-control")).toBe("no-store");
    const lines = r.text.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toStartWith("job_id,job_code,job_name,job_status,pickup_address");
    expect(lines.length).toBe(4); // header + 3 jobs
    expect(r.text).toContain('"A, B"'); // a comma inside an address is quoted
  });
  test("text from users cannot become a spreadsheet formula", async () => {
    vehicleData = [vehicle(1, "active", "=HYPERLINK(\"http://evil\")"), vehicle(2, "active", "+cmd")];
    try {
      const r = await get(appWith(fakeSources().sources), "/api/v1/reports/vehicles?format=csv", "admin-a");
      expect(r.text).toContain("'=HYPERLINK"); expect(r.text).toContain("'+cmd");
      expect(r.text).not.toMatch(/(^|,)=HYPERLINK/m);
    } finally { vehicleData = [vehicle(1), vehicle(2, "maintenance"), vehicle(3)]; }
  });
  test("an export walks through every page of the owning service", async () => {
    vehicleData = Array.from({ length: 250 }, (_, i) => vehicle(i + 1));
    try {
      const { sources, calls } = fakeSources();
      const r = await get(appWith(sources), "/api/v1/reports/vehicles?format=csv", "admin-a");
      expect(r.text.trim().split("\r\n").length).toBe(251);
      expect(calls.filter((c) => c.method === "vehicles").map((c) => (c.args[1] as any).offset)).toEqual([0, 100, 200]);
    } finally { vehicleData = [vehicle(1), vehicle(2, "maintenance"), vehicle(3)]; }
  });
  test("an export that would be too large is refused instead of building something huge", async () => {
    const { sources } = fakeSources({ jobs: (async () => ({ total: 6000, rows: [] })) as Sources["jobs"] });
    const r = await get(appWith(sources), "/api/v1/reports/jobs?format=csv", "admin-a");
    expect(r.status).toBe(422); expect(r.json.error.code).toBe("TOO_MANY_ROWS");
  });
  test("every report can be exported", async () => {
    const app = appWith(fakeSources().sources);
    for (const name of ["vehicles", "routes", "jobs", "alerts", "gps"]) {
      const r = await get(app, `/api/v1/reports/${name}?format=csv`, "dispatcher-a");
      expect(r.status).toBe(200);
      expect(r.response.headers.get("content-disposition")).toContain(`report-${name}-`);
      expect(r.text.split("\r\n").length).toBeGreaterThan(2);
    }
  });
});
