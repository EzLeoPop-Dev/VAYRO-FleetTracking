// Needs the Docker stack. Walks a company through the whole life cycle via the gateway: register -> approve -> sign in ->
// suspend -> blocked -> re-open -> sign in, and a rejected request. Leaves its test companies/users in the database.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const base = `${process.env.GATEWAY_URL ?? "http://127.0.0.1:3001"}/api/v1`;
const suffix = randomUUID();
const password = `TestOnly-${suffix}`;
let checks = 0;
function check(name, condition) { assert.ok(condition, name); console.log("PASS", name); checks++; }
async function call(method, path, token, body) {
  const response = await fetch(base + path, { method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, ...(await response.json()) };
}
const psql = (q, db) => execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "vayro", "-d", db, "-tAc", q], { cwd: root, encoding: "utf8" }).trim();

// A Platform Admin, created the way an operator does it.
const platformEmail = `platform-co-${suffix}@example.test`;
execFileSync("docker", ["compose", "exec", "-T", "-e", `ADMIN_EMAIL=${platformEmail}`, "-e", "ADMIN_FULL_NAME=Platform", "-e", `ADMIN_PASSWORD=${password}`, "user-service", "bun", "scripts/create-platform-admin.ts"], { cwd: root, stdio: "pipe" });
const platform = (await call("POST", "/auth/login", null, { email: platformEmail, password })).data.access_token;
check("Platform Admin signs in", Boolean(platform));

async function register(label) {
  const email = `${label}-${suffix}@example.test`;
  const r = await call("POST", "/companies/register", null, { company_name: `${label} ${suffix.slice(0, 8)}`, contact_name: "Contact", contact_email: email,
    admin_full_name: label, admin_email: email, admin_password: password });
  assert.equal(r.status, 200);
  return { id: r.data.company_id, email };
}
const login = (email) => call("POST", "/auth/login", null, { email, password });
const logsOf = (id, action) => Number(psql(`SELECT count(*) FROM system_log WHERE entity_type='company' AND entity_id='${id}' AND action='${action}'`, "company_db"));

const life = await register("co-life");
let r = await login(life.email);
check("A pending workspace cannot sign in", r.status === 403 && r.error?.code === "WORKSPACE_NOT_ACTIVE");
r = await call("GET", `/companies/${life.id}`, platform);
check("Platform Admin reads the pending company", r.status === 200 && r.data.workspace_status === "pending" && r.data.company_id === life.id);

r = await call("PATCH", `/companies/${life.id}/approve`, platform);
check("Approve makes it active", r.status === 200 && r.data.workspace_status === "active");
r = await login(life.email);
check("The admin can now sign in", r.status === 200);
const companyAdmin = r.data.access_token;
check("Approving twice is 409", (await call("PATCH", `/companies/${life.id}/approve`, platform)).status === 409);
check("Company Admin cannot approve, list or edit", (await call("PATCH", `/companies/${life.id}/approve`, companyAdmin)).status === 403
  && (await call("GET", "/companies", companyAdmin)).status === 403 && (await call("PUT", `/companies/${life.id}`, companyAdmin, { company_name: "x" })).status === 403);
check("Nobody without a token gets in", (await call("GET", "/companies")).status === 401);

r = await call("PUT", `/companies/${life.id}`, platform, { contact_phone: "0812345678", contact_name: "New Contact" });
check("Platform Admin edits contact details", r.status === 200 && r.data.contact_phone === "0812345678" && r.data.contact_name === "New Contact" && r.data.workspace_status === "active");

r = await call("PATCH", `/companies/${life.id}/status`, platform, { workspace_status: "suspended" });
check("Suspend", r.status === 200 && r.data.workspace_status === "suspended");
r = await login(life.email);
check("A suspended workspace cannot sign in", r.status === 403 && r.error?.code === "WORKSPACE_NOT_ACTIVE");
r = await call("PATCH", `/companies/${life.id}/status`, platform, { workspace_status: "active" });
check("Re-open", r.status === 200 && r.data.workspace_status === "active");
check("The admin can sign in again", (await login(life.email)).status === 200);
check("Status change is written to the system log", logsOf(life.id, "company.approve") === 1 && logsOf(life.id, "company.suspend") === 1 && logsOf(life.id, "company.activate") === 1 && logsOf(life.id, "company.update") === 1);

const rejected = await register("co-rejected");
r = await call("PATCH", `/companies/${rejected.id}/reject`, platform, { reason: "Not a real company" });
check("Reject a pending request", r.status === 200 && r.data.workspace_status === "rejected");
check("A rejected workspace cannot sign in", (await login(rejected.email)).status === 403);
check("A rejected request is not approved afterwards", (await call("PATCH", `/companies/${rejected.id}/approve`, platform)).status === 409);
check("The reason is in the log", psql(`SELECT new_value->>'reason' FROM system_log WHERE entity_id='${rejected.id}' AND action='company.reject'`, "company_db") === "Not a real company");

r = await call("GET", `/companies?q=${suffix.slice(0, 8)}&limit=1`, platform);
check("Search finds the test companies and pages them", r.status === 200 && r.data.length === 1 && r.meta.total === 2 && r.meta.pages === 2);
r = await call("GET", `/companies?q=${suffix.slice(0, 8)}&status=rejected`, platform);
check("Filter by status", r.status === 200 && r.data.length === 1 && r.data[0].company_id === rejected.id);
check("A bad filter is 422", (await call("GET", "/companies?status=deleted", platform)).status === 422);
check("An unknown company is 404", (await call("GET", "/companies/922337203685477580", platform)).status === 404);
check("/internal is not reachable through the gateway", (await fetch(`${base.replace("/api/v1", "")}/internal/companies/${life.id}`)).status === 404);

console.log(`\n${checks} checks passed`);
