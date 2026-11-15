// Real HTTP + container restart proof. Local development only; retains its uniquely named fixture data.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const base = `${process.env.GATEWAY_URL ?? "http://127.0.0.1:3001"}/api/v1`;
const suffix = randomUUID(), password = `TestOnly-${suffix}`, email = `gps-admin-${suffix}@example.test`;
let checks = 0;
function check(name, condition) { assert.ok(condition, name); checks++; console.log("PASS", name); }
// Each service owns its database: company in company_db, vehicles in vehicle_db, jobs in transport_db, GPS positions in gps_data_db.
const psql = (q, db = "company_db") => execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "vayro", "-d", db, "-tAc", q], { cwd: root, encoding: "utf8" }).trim();
async function call(method, path, token, body) {
  const r = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json()) };
}
const reg = await call("POST", "/companies/register", null, { company_name: "GPS restart test", contact_email: email, admin_full_name: "GPS Test Admin", admin_email: email, admin_password: password });
assert.equal(reg.status, 200);
const company = reg.data.company_id; assert.match(company, /^[0-9]+$/);
psql(`UPDATE company SET workspace_status='active' WHERE company_id=${company}`);
const admin = (await call("POST", "/auth/login", null, { email, password })).data;
assert.match(admin.user.user_id, /^[0-9]+$/);
const driverEmail = `gps-driver-${suffix}@example.test`;
const created = await call("POST", "/users", admin.access_token, { full_name: "GPS Test Driver", email: driverEmail, password, role: "driver" });
check("User Service creates driver", created.status === 201);
const driverId = created.data.user_id; assert.match(driverId, /^[0-9]+$/);
const vehicle = psql(`INSERT INTO vehicles(company_id,vehicle_code,license_plate,current_driver_id) VALUES (${company},'V-${suffix}','TEST-GPS',${driverId}) RETURNING vehicle_id`, "vehicle_db").split("\n")[0].trim();
assert.match(vehicle, /^[0-9]+$/);
psql(`INSERT INTO transport_jobs(company_id,job_code,pickup_address,delivery_address,vehicle_id,driver_id,job_status,created_by) VALUES (${company},'J-${suffix}','test pickup','test delivery',${vehicle},${driverId},'in_progress',${admin.user.user_id})`, "transport_db");
const driver = (await call("POST", "/auth/login", null, { email: driverEmail, password })).data;
const device = await call("POST", "/gps-devices", admin.access_token, { vehicle_id: vehicle, device_code: `phone-${suffix}`, source_type: "driver_mobile_app" });
check("GPS device uses real vehicle and company", device.status === 201 && device.data.company_id === company && device.data.vehicle_id === vehicle);
const body = { device_code: device.data.device_code, external_record_id: `point-${suffix}`, recorded_at: new Date().toISOString(), latitude: 13.7563, longitude: 100.5018,
  speed_kmh: null, direction_degree: null, accuracy_meters: null };
const point = await call("POST", "/gps/ingest", driver.access_token, body);
check("Driver sends canonical GPS fields through gateway", point.status === 201 && point.data.speed_kmh === null && typeof point.data.gps_location_id === "string");
assert.match(point.data.gps_location_id, /^[0-9]+$/);
check("duplicate record rejected", (await call("POST", "/gps/ingest", driver.access_token, body)).status === 409);
check("history is stored before restart", (await call("GET", `/gps/vehicles/${vehicle}/locations`, admin.access_token)).data.length === 1);
const hist = await call("GET", `/gps/vehicles/${vehicle}/locations`, admin.access_token);
check("history reports anomalies per point and gaps for the range", Array.isArray(hist.data[0].anomalies) && Array.isArray(hist.meta.gaps));
// Encrypted provider credentials, through the gateway (needs CREDENTIALS_ENCRYPTION_KEY on gps-device-service)
const secret = `provider-secret-${suffix}`;
const provider = await call("POST", "/gps-devices", admin.access_token, { vehicle_id: vehicle, device_code: `provider-${suffix}`, source_type: "provider_api", provider_name: "Test provider", credentials: { api_user: "u", api_password: secret } });
check("provider credentials accepted and flagged, never echoed", provider.status === 201 && provider.data.has_credentials === true && !JSON.stringify(provider).includes(secret) && !("credentials" in provider.data));
const storedCredentials = psql(`SELECT credentials_encrypted FROM gps_devices WHERE gps_device_id=${provider.data.gps_device_id}`, "gps_device_db");
check("credentials are stored encrypted, not as text", storedCredentials.startsWith("v1:") && !storedCredentials.includes(secret));
check("credentials are not readable through GET", !JSON.stringify(await call("GET", `/gps-devices/${provider.data.gps_device_id}`, admin.access_token)).includes(secret));
execFileSync("docker", ["compose", "restart", "gps-data-service"], { cwd: root, stdio: "pipe" });
let latest;
for (let attempt = 0; attempt < 60; attempt++) {
  try { latest = await call("GET", `/gps/vehicles/${vehicle}/latest`, admin.access_token); if (latest.status === 200) break; } catch {}
  await new Promise(resolve => setTimeout(resolve, 250));
}
check("same GPS position survives actual container restart", latest?.status === 200 && latest.data.gps_location_id === point.data.gps_location_id);
check("device survives container restart", (await call("GET", `/gps-devices/${device.data.gps_device_id}`, admin.access_token)).status === 200);
check("DELETE closes connection without removing history", (await call("DELETE", `/gps-devices/${device.data.gps_device_id}`, admin.access_token)).status === 200);
check("closed connection rejects additional GPS points", (await call("POST", "/gps/ingest", driver.access_token, { ...body, external_record_id: `closed-${suffix}` })).status === 403);
const rowCount = psql(`SELECT count(*) FROM gps_locations WHERE gps_location_id=${point.data.gps_location_id}`, "gps_data_db");
check("persisted row exists in PostgreSQL", rowCount === "1");
console.log(`${checks} HTTP/restart checks passed`);
