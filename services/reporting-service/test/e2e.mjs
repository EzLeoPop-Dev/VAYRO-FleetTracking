// End-to-end test of Reporting & Dashboard through the gateway, against the running stack.
// It creates two companies with their users, vehicles, devices, GPS points, jobs and alerts (seeded straight into each
// service's own database with docker compose exec), then checks the dashboards and reports against those numbers and
// against counts read directly from the databases. Fixtures are unique per run and are kept. Local development only.
//   docker compose up -d --build --wait   then   node services/reporting-service/test/e2e.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const base = `${process.env.GATEWAY_URL ?? "http://127.0.0.1:3001"}/api/v1`;
const suffix = randomUUID().slice(0, 8), password = `TestOnly-${randomUUID()}`;
let checks = 0;
function check(name, condition, extra) { assert.ok(condition, `${name} ${extra === undefined ? "" : JSON.stringify(extra)}`); checks++; console.log("PASS", name); }
const psql = (q, db) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "vayro", "-d", db, "-tAc", q], { cwd: root, encoding: "utf8" }).trim();
const first = (out) => out.split("\n")[0].trim();
async function call(method, path, token, body) {
  const r = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const type = r.headers.get("content-type") ?? "";
  return { status: r.status, headers: r.headers, ...(type.includes("json") ? await r.json() : { text: await r.text() }) };
}

// ---- two companies, each with an admin; company A also has a dispatcher and a driver
async function workspace(label) {
  const email = `rep-${label}-${suffix}@example.test`;
  const reg = await call("POST", "/companies/register", null, { company_name: `Report test ${label} ${suffix}`, contact_email: email, admin_full_name: `Admin ${label}`, admin_email: email, admin_password: password });
  assert.equal(reg.status, 200);
  const id = reg.data.company_id;
  psql(`UPDATE company SET workspace_status='active' WHERE company_id=${id}`, "company_db");
  const token = (await call("POST", "/auth/login", null, { email, password })).data.access_token;
  return { id, token };
}
const A = await workspace("a"), B = await workspace("b");
async function addUser(ws, role) {
  const email = `rep-${role}-${suffix}@example.test`;
  const r = await call("POST", "/users", ws.token, { full_name: `Test ${role}`, email, password, role });
  assert.equal(r.status, 201);
  return { id: r.data.user_id, token: (await call("POST", "/auth/login", null, { email, password })).data.access_token };
}
const dispatcher = await addUser(A, "dispatcher"), driver = await addUser(A, "driver");
const platformEmail = `rep-platform-${suffix}@example.test`;
execFileSync("docker", ["compose", "exec", "-T", "-e", `ADMIN_EMAIL=${platformEmail}`, "-e", "ADMIN_FULL_NAME=Report Platform", "-e", `ADMIN_PASSWORD=${password}`, "user-service", "bun", "scripts/create-platform-admin.ts"], { cwd: root, stdio: "pipe" });
const platform = (await call("POST", "/auth/login", null, { email: platformEmail, password })).data.access_token;

// ---- data of company A: 2 vehicles ("=..." code on purpose), devices, points, jobs, alerts; company B: 1 vehicle, 1 job, 1 alert
const typeA = first(psql(`INSERT INTO vehicle_types(company_id,type_name) VALUES (${A.id},'Truck') RETURNING vehicle_type_id`, "vehicle_db"));
const vehicle = (ws, code, status, type = "NULL") => first(psql(`INSERT INTO vehicles(company_id,vehicle_type_id,vehicle_code,license_plate,vehicle_status) VALUES (${ws.id},${type},'${code}','PL-${suffix}','${status}') RETURNING vehicle_id`, "vehicle_db"));
const v1 = vehicle(A, `REP1-${suffix}`, "active", typeA), v2 = vehicle(A, `=REP2-${suffix}`, "maintenance"), vb = vehicle(B, `REPB-${suffix}`, "active");
const device = await call("POST", "/gps-devices", A.token, { vehicle_id: v1, device_code: `rep-dev-${suffix}`, source_type: "gps_device" });
assert.equal(device.status, 201);
// vehicle 1: four points 10 minutes apart, each 0.01 degree further north (about 1.112 km); the newest arrived about a minute ago.
// vehicle 2: a single point from two hours ago.
psql(`INSERT INTO gps_locations(company_id,vehicle_id,latitude,longitude,speed_kmh,recorded_at,received_at) VALUES
  (${A.id},${v1},13.7000,100.5,30,now()-interval '30 minutes',now()-interval '30 minutes'+interval '10 seconds'),
  (${A.id},${v1},13.7100,100.5,40,now()-interval '20 minutes',now()-interval '20 minutes'+interval '10 seconds'),
  (${A.id},${v1},13.7200,100.5,50,now()-interval '10 minutes',now()-interval '10 minutes'+interval '10 seconds'),
  (${A.id},${v1},13.7300,100.5,60,now()-interval '2 minutes',now()-interval '110 seconds'),
  (${A.id},${v2},13.8000,100.6,0,now()-interval '2 hours',now()-interval '2 hours'),
  (${B.id},${vb},13.9000,100.7,10,now()-interval '1 minute',now()-interval '1 minute')`, "gps_data_db");
psql(`INSERT INTO transport_jobs(company_id,job_code,job_name,pickup_address,delivery_address,vehicle_id,job_status,actual_start_at,actual_end_at,created_by) VALUES
  (${A.id},'J1-${suffix}','Pending job','Pickup, Bangkok','Delivery',${v1},'pending',NULL,NULL,${A.id}),
  (${A.id},'J2-${suffix}','Running job','Pickup','Delivery',${v1},'in_progress',now()-interval '1 hour',NULL,${A.id}),
  (${A.id},'J3-${suffix}','Done job','Pickup','Delivery',${v2},'completed',now()-interval '3 hours',now()-interval '90 minutes',${A.id}),
  (${B.id},'JB-${suffix}','Other company job','Pickup','Delivery',${vb},'pending',NULL,NULL,${B.id})`, "transport_db");
psql(`INSERT INTO alerts(company_id,vehicle_id,alert_type,title,alert_status,triggered_at,resolved_at) VALUES
  (${A.id},${v1},'overspeed','Overspeed test','unread',now()-interval '30 minutes',NULL),
  (${A.id},${v1},'gps_offline','Offline test','resolved',now()-interval '3 hours',now()-interval '150 minutes'),
  (${B.id},${vb},'overspeed','Other company alert','unread',now()-interval '30 minutes',NULL)`, "alert_db");

// ---- who may call what
check("no token is 401", (await call("GET", "/dashboard/company")).status === 401 && (await call("GET", "/reports/jobs")).status === 401);
check("a driver is refused everywhere", (await call("GET", "/dashboard/company", driver.token)).status === 403 && (await call("GET", "/reports/vehicles", driver.token)).status === 403);
check("a company admin cannot open the platform dashboard", (await call("GET", "/dashboard/platform", A.token)).status === 403);
check("a company user cannot ask about another company", (await call("GET", `/dashboard/company?company_id=${B.id}`, A.token)).status === 403 && (await call("GET", `/reports/jobs?company_id=${B.id}`, dispatcher.token)).status === 403);
check("a platform admin naming a company that does not exist gets 404, not zeros", (await call("GET", "/dashboard/company?company_id=999999999999", platform)).status === 404 && (await call("GET", "/reports/jobs?company_id=999999999999", platform)).status === 404);
check("a platform admin must name a company", (await call("GET", "/dashboard/company", platform)).status === 422 && (await call("GET", "/reports/vehicles", platform)).status === 422);

// ---- company dashboard of A
let r = await call("GET", "/dashboard/company", A.token);
check("company dashboard answers", r.status === 200 && r.data.company_id === A.id, r);
const d = r.data;
check("vehicles by status", d.vehicles.available && d.vehicles.total === 2 && d.vehicles.by_status.active === 1 && d.vehicles.by_status.maintenance === 1, d.vehicles);
check("GPS: one vehicle current, one delayed, none without data", d.gps.available && d.gps.current === 1 && d.gps.delayed === 1 && d.gps.no_data === 0, d.gps);
check("devices", d.gps_devices.available && d.gps_devices.total === 1, d.gps_devices);
check("jobs by status and average duration", d.jobs.available && d.jobs.total === 3 && d.jobs.by_status.pending === 1 && d.jobs.by_status.in_progress === 1 && d.jobs.by_status.completed === 1 && d.jobs.avg_duration_minutes === 90, d.jobs);
check("alerts by type, status and open count", d.alerts.available && d.alerts.total === 2 && d.alerts.by_type.overspeed === 1 && d.alerts.open_total === 1 && d.alerts.avg_resolution_minutes === 30, d.alerts);
check("users of the company", d.users.available && d.users.total === 3 && d.users.by_role.company_admin === 1 && d.users.by_role.dispatcher === 1 && d.users.by_role.driver === 1, d.users);
check("company numbers match the databases", d.vehicles.total === Number(psql(`SELECT count(*) FROM vehicles WHERE company_id=${A.id}`, "vehicle_db")) && d.jobs.total === Number(psql(`SELECT count(*) FROM transport_jobs WHERE company_id=${A.id}`, "transport_db")));
r = await call("GET", "/dashboard/company", dispatcher.token);
check("a dispatcher sees jobs and vehicle status but no user counts", r.status === 200 && !("users" in r.data) && r.data.jobs.total === 3 && r.data.vehicles.total === 2, r.data);
r = await call("GET", "/dashboard/company", B.token);
check("company B only sees its own data", r.status === 200 && r.data.vehicles.total === 1 && r.data.jobs.total === 1 && r.data.alerts.total === 1 && r.data.gps.current === 1 && r.data.users.total === 1, r.data);
check("a platform admin can look at a named company", (await call("GET", `/dashboard/company?company_id=${A.id}`, platform)).data.vehicles.total === 2);
check("the period must be 1 to 31 days", (await call("GET", "/dashboard/company?days=0", A.token)).status === 422 && (await call("GET", "/dashboard/company?days=32", A.token)).status === 422);

// ---- platform dashboard, compared with the databases (these include all the data already in the system)
r = await call("GET", "/dashboard/platform", platform);
const p = r.data;
check("platform dashboard: every section is available", r.status === 200 && ["companies", "users", "vehicles", "gps_devices", "jobs", "alerts"].every((k) => p[k].available), r);
check("companies match the database", p.companies.total === Number(psql("SELECT count(*) FROM company", "company_db")) && p.companies.by_status.active >= 2 && p.companies.by_status.pending >= 0);
check("users match the database", p.users.total === Number(psql("SELECT count(*) FROM users", "user_db")) && p.users.by_role.platform_admin >= 1);
check("vehicles and devices match the databases", p.vehicles.total === Number(psql("SELECT count(*) FROM vehicles", "vehicle_db")) && p.gps_devices.total === Number(psql("SELECT count(*) FROM gps_devices", "gps_device_db")));
check("jobs of the last 30 days match the database", p.jobs.total === Number(psql("SELECT count(*) FROM transport_jobs WHERE created_at >= now() - interval '30 days'", "transport_db")));
check("alerts match the database", p.alerts.total === Number(psql("SELECT count(*) FROM alerts WHERE triggered_at >= now() - interval '30 days'", "alert_db")) && p.alerts.open_total === Number(psql("SELECT count(*) FROM alerts WHERE alert_status <> 'resolved'", "alert_db")));

// ---- reports
r = await call("GET", "/reports/vehicles", A.token);
check("vehicles report: both vehicles, with GPS status from the last received time", r.status === 200 && r.data.rows.length === 2 && r.meta.total === 2, r);
const row1 = r.data.rows.find((x) => x.vehicle_id === v1), row2 = r.data.rows.find((x) => x.vehicle_id === v2);
check("vehicle 1 is current with its device, vehicle 2 is delayed", row1.gps_status === "current" && row1.vehicle_type === "Truck" && row1.device_count === 1 && row1.latitude === 13.73 && row2.gps_status === "delayed", [row1, row2]);
check("vehicles report can be filtered by status and paged", (await call("GET", "/reports/vehicles?status=maintenance", A.token)).data.rows.length === 1 && (await call("GET", "/reports/vehicles?limit=1&page=2", A.token)).data.rows.length === 1);

r = await call("GET", "/reports/routes", dispatcher.token);
const route1 = r.data.rows.find((x) => x.vehicle_id === v1);
check("routes report: about 3.3 km for vehicle 1 from four points", r.status === 200 && route1.points === 4 && route1.distance_km > 3.3 && route1.distance_km < 3.4 && route1.max_speed_kmh === 60 && route1.avg_speed_kmh === 45, route1);
check("routes summary is marked approximate and counts only vehicles with data", r.data.summary.distance_is_approximate === true && r.data.summary.vehicles_with_data === 2 && r.data.summary.total_points === 5, r.data.summary);
check("routes report for one vehicle; an unknown vehicle is 404", (await call("GET", `/reports/routes?vehicle_id=${v1}`, A.token)).data.rows.length === 1 && (await call("GET", `/reports/routes?vehicle_id=${vb}`, A.token)).status === 404);
check("routes report period is limited to 31 days and must not run backwards", (await call("GET", "/reports/routes?from=2026-01-01T00:00:00Z&to=2026-06-01T00:00:00Z", A.token)).status === 422 && (await call("GET", "/reports/routes?from=2026-06-01T00:00:00Z&to=2026-05-01T00:00:00Z", A.token)).status === 422);

r = await call("GET", "/reports/jobs", A.token);
check("jobs report: three jobs, summary from transport-service", r.status === 200 && r.data.rows.length === 3 && r.data.summary.total_in_period === 3 && r.data.summary.avg_duration_minutes === 90, r);
check("jobs report filters by status", (await call("GET", "/reports/jobs?status=completed", A.token)).data.rows.map((j) => j.job_code).join() === `J3-${suffix}`);
check("a job from the other company never shows up", !JSON.stringify(r.data).includes(`JB-${suffix}`));
check("jobs report shows the duration of a completed job", r.data.rows.find((j) => j.job_status === "completed").duration_minutes === 90);

r = await call("GET", "/reports/alerts", A.token);
check("alerts report: two alerts, one still open", r.status === 200 && r.data.rows.length === 2 && r.data.summary.open_total === 1 && r.data.summary.by_status.resolved === 1, r);
check("alerts report filters by type and status", (await call("GET", "/reports/alerts?type=gps_offline", A.token)).data.rows.length === 1 && (await call("GET", "/reports/alerts?status=unread", A.token)).data.rows.length === 1);
check("the resolved alert reports how long it took", r.data.rows.find((a) => a.alert_status === "resolved").resolution_minutes === 30);

r = await call("GET", "/reports/gps", A.token);
check("GPS report: status counts, points, no gaps or anomalies in the clean data", r.status === 200 && r.data.summary.vehicles_by_gps_status.current === 1 && r.data.summary.vehicles_by_gps_status.delayed === 1 && r.data.summary.total_points === 5 && r.data.summary.gaps === 0 && r.data.summary.anomalies === 0, r.data.summary);
check("GPS report rows carry the device state", r.data.rows.find((x) => x.vehicle_id === v1).devices_connected >= 0 && r.data.rows.find((x) => x.vehicle_id === v1).device_count === 1);

// ---- CSV export
r = await call("GET", "/reports/jobs?format=csv", A.token);
// fetch().text() drops a UTF-8 byte-order mark, so look at the raw bytes for it
const raw = new Uint8Array(await (await fetch(`${base}/reports/jobs?format=csv`, { headers: { authorization: `Bearer ${A.token}` } })).arrayBuffer());
check("jobs export is a CSV download with a name, no caching and a byte-order mark for Excel", r.status === 200 && r.headers.get("content-type").startsWith("text/csv") && r.headers.get("content-disposition").includes("report-jobs-") && r.headers.get("cache-control") === "no-store" && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf, [r.headers.get("content-type"), r.headers.get("content-disposition"), r.headers.get("cache-control")]);
check("jobs export has a header and one line per job", r.text.trim().split("\r\n").length === 4 && r.text.includes('"Pickup, Bangkok"'));
r = await call("GET", "/reports/vehicles?format=csv", A.token);
check("a vehicle code that starts with = cannot become a formula in the export", r.status === 200 && r.text.includes(`'=REP2-${suffix}`) && !r.text.includes(`,=REP2-${suffix}`));
for (const name of ["routes", "alerts", "gps"]) check(`${name} can be exported`, (await call("GET", `/reports/${name}?format=csv`, A.token)).status === 200);

console.log(`${checks} Reporting & Dashboard checks passed`);
