// The Platform Admin endpoints of company-service (list, get, edit, approve, reject, suspend) against company_db.
// auth-service is replaced by a fake that says who each token belongs to. Fixtures use a unique name per run and are kept.
import { describe, expect, test } from "bun:test";
import { ApiError, type Caller } from "@vayro/service-kit";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the company_db connection string");
process.env.AUTH_SERVICE_URL ??= "http://127.0.0.1:1";
process.env.USER_SERVICE_URL ??= "http://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN ??= "unit-test-internal-token-not-for-deployment-123456";
const { createCompanyApp } = await import("../src/app");
const { prisma } = await import("../src/lib/prisma");

const run = crypto.randomUUID().slice(0, 8);
const person = (token: string, role: Caller["role"], company: string | null): [string, Caller] =>
  [token, { role, company_id: company, user_id: token === "platform" ? "7001" : "7002", full_name: token, email: `${token}@example.test`, phone: null, account_status: "active", workspace_status: "active" }];
const people = new Map<string, Caller>([person("platform", "platform_admin", null), person("admin", "company_admin", "1"), person("dispatcher", "dispatcher", "1"), person("driver", "driver", "1")]);
const resolveUser = async (authorization?: string | null) => {
  const user = people.get(authorization?.match(/^Bearer (\S+)$/i)?.[1] ?? "");
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Missing or invalid access token");
  return user;
};
const app = createCompanyApp({ resolveUser }).compile();
async function call(method: string, path: string, token?: string, body?: object) {
  const response = await app.handle(new Request(`http://localhost${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: response.status, json: await response.json() };
}
const seed = async (name: string, status: "pending" | "active" | "suspended" | "rejected" = "pending", extra: object = {}) =>
  String((await prisma.company.create({ data: { company_name: `${name} ${run}`, workspace_status: status, contact_email: `${name.toLowerCase().replace(/\W+/g, "-")}-${run}@example.test`, ...extra } })).company_id);
const logs = (id: string, action?: string) => prisma.systemLog.findMany({ where: { entity_id: id, ...(action ? { action } : {}) }, orderBy: { system_log_id: "asc" } });
const statusOf = async (id: string) => (await prisma.company.findUnique({ where: { company_id: BigInt(id) } }))!.workspace_status;

describe("who may use the company endpoints", () => {
  test("registration is public; everything else is for the Platform Admin only", async () => {
    const id = await seed("Roles");
    const calls: [string, string, object | undefined][] = [["GET", "/api/v1/companies", undefined], ["GET", `/api/v1/companies/${id}`, undefined], ["PUT", `/api/v1/companies/${id}`, { company_name: "x" }],
      ["PATCH", `/api/v1/companies/${id}/approve`, undefined], ["PATCH", `/api/v1/companies/${id}/reject`, undefined], ["PATCH", `/api/v1/companies/${id}/status`, { workspace_status: "suspended" }]];
    for (const [method, path, body] of calls) {
      expect((await call(method, path, undefined, body)).status).toBe(401);
      for (const token of ["admin", "dispatcher", "driver"]) expect((await call(method, path, token, body)).status).toBe(403);
    }
    expect(await statusOf(id)).toBe("pending"); // none of those calls changed anything
    expect((await call("POST", "/api/v1/companies/register", undefined, { company_name: "" })).status).toBe(422); // reachable without a token (fails validation, not authentication)
  });
});

describe("list and search", () => {
  test("newest first, paged, filtered by status", async () => {
    const tag = `Zz${run}`; // matches only these three (other tests' fixtures carry the run id too)
    const a = await seed(`${tag} A`), b = await seed(`${tag} B`, "active"), c = await seed(`${tag} C`, "suspended");
    const all = await call("GET", `/api/v1/companies?q=${tag}&limit=2&page=1`, "platform");
    expect(all.status).toBe(200);
    expect(all.json.meta).toMatchObject({ page: 1, limit: 2, total: 3, pages: 2 });
    expect(all.json.data.map((x: any) => x.company_id)).toEqual([c, b]); // newest first
    expect((await call("GET", `/api/v1/companies?q=${tag}&limit=2&page=2`, "platform")).json.data.map((x: any) => x.company_id)).toEqual([a]);
    const active = await call("GET", `/api/v1/companies?q=${tag}&status=active`, "platform");
    expect(active.json.data.map((x: any) => x.company_id)).toEqual([b]);
    expect(active.json.data[0]).toMatchObject({ workspace_status: "active", company_name: `${tag} B ${run}` });
    expect(active.json.data[0].company_id).toBeString();
  });
  test("search finds names and contacts, ignores case, and treats % and _ as plain characters", async () => {
    const percent = await seed("Sale 100% off"), other = await seed("Sale 1000 off"), byContact = await seed("Quiet", "pending", { contact_name: "Somchai Jaidee" });
    expect((await call("GET", `/api/v1/companies?q=${encodeURIComponent("100% off")}`, "platform")).json.data.map((x: any) => x.company_id)).toContain(percent);
    const wild = (await call("GET", `/api/v1/companies?q=${encodeURIComponent("1%0")}`, "platform")).json.data.map((x: any) => x.company_id);
    expect(wild).not.toContain(percent); expect(wild).not.toContain(other); // "%" is not a wildcard
    expect((await call("GET", `/api/v1/companies?q=${encodeURIComponent("1_00")}`, "platform")).json.data.map((x: any) => x.company_id)).not.toContain(percent); // nor "_"
    expect((await call("GET", `/api/v1/companies?q=SOMCHAI&status=pending`, "platform")).json.data.map((x: any) => x.company_id)).toContain(byContact);
    expect((await call("GET", `/api/v1/companies?q=${encodeURIComponent(`quiet-${run}@EXAMPLE`)}`, "platform")).json.data.map((x: any) => x.company_id)).toEqual([byContact]); // by e-mail
    expect((await call("GET", `/api/v1/companies?q=no-such-company-${run}`, "platform")).json).toMatchObject({ data: [], meta: { total: 0, pages: 1 } });
  });
  test("bad paging and filters are 422", async () => {
    for (const query of ["limit=0", "limit=101", "page=0", "status=deleted", "q="]) expect((await call("GET", `/api/v1/companies?${query}`, "platform")).status).toBe(422);
  });
});

describe("one company", () => {
  test("details; unknown and malformed ids", async () => {
    const id = await seed("Detail", "active", { contact_name: "Ann", contact_phone: "0812345678" });
    const r = await call("GET", `/api/v1/companies/${id}`, "platform");
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ company_id: id, company_name: `Detail ${run}`, workspace_status: "active", contact_name: "Ann", contact_phone: "0812345678" });
    expect(r.json.data.created_at).toBeString();
    expect(r.json.data).not.toHaveProperty("password_hash");
    expect((await call("GET", "/api/v1/companies/922337203685477580", "platform")).status).toBe(404);
    for (const bad of ["abc", "0", "-1", "9223372036854775808"]) expect((await call("GET", `/api/v1/companies/${bad}`, "platform")).status).toBe(422);
  });
  test("editing: omitted fields stay, null clears, the e-mail stays unique and is lower-cased, and every edit is logged", async () => {
    const id = await seed("Edit", "pending", { contact_name: "Old Name", contact_phone: "111" });
    const taken = await seed("Taken");
    const r = await call("PUT", `/api/v1/companies/${id}`, "platform", { company_name: `  Edited ${run}  `, contact_phone: null });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ company_name: `Edited ${run}`, contact_name: "Old Name", contact_phone: null, workspace_status: "pending" });
    expect((await call("PUT", `/api/v1/companies/${id}`, "platform", { contact_email: `NEW-${run}@Example.TEST` })).json.data.contact_email).toBe(`new-${run}@example.test`);
    expect((await call("PUT", `/api/v1/companies/${id}`, "platform", { contact_email: `taken-${run}@example.test` })).status).toBe(409);
    const [first, second] = await logs(id, "company.update");
    expect(first).toMatchObject({ user_id: 7001n, company_id: BigInt(id), result: "success" });
    expect(first!.old_value).toMatchObject({ company_name: `Edit ${run}`, contact_phone: "111" });
    expect(first!.new_value).toMatchObject({ company_name: `Edited ${run}`, contact_phone: null });
    expect(second).toBeDefined();
    expect((await logs(id, "company.update")).length).toBe(2); // the rejected duplicate was not logged
    expect(await statusOf(taken)).toBe("pending");
  });
  test("the workspace status cannot be changed by editing", async () => {
    const id = await seed("NoStatusEdit");
    await call("PUT", `/api/v1/companies/${id}`, "platform", { workspace_status: "active" });
    await call("PUT", `/api/v1/companies/${id}`, "platform", { company_name: "Name only", workspace_status: "active" });
    expect(await statusOf(id)).toBe("pending");
  });
  test("an empty or invalid edit is 422; an unknown company is 404", async () => {
    const id = await seed("Invalid");
    for (const body of [{}, { company_name: "   " }, { company_name: "x".repeat(151) }, { contact_email: "not-an-email" }, { contact_name: "x".repeat(101) }, { company_name: null }]) {
      expect((await call("PUT", `/api/v1/companies/${id}`, "platform", body as object)).status).toBe(422);
    }
    expect((await call("PUT", "/api/v1/companies/922337203685477580", "platform", { company_name: "x" })).status).toBe(404);
  });
});

describe("approve, reject, suspend", () => {
  test("a pending request is approved once, and the change is logged with who did it", async () => {
    const id = await seed("Approve");
    const r = await call("PATCH", `/api/v1/companies/${id}/approve`, "platform");
    expect(r.status).toBe(200); expect(r.json.data.workspace_status).toBe("active");
    expect(await statusOf(id)).toBe("active");
    const [log] = await logs(id, "company.approve");
    expect(log).toMatchObject({ user_id: 7001n, entity_type: "company", result: "success" });
    expect(log!.old_value).toEqual({ workspace_status: "pending" }); expect(log!.new_value).toEqual({ workspace_status: "active" });
    const again = await call("PATCH", `/api/v1/companies/${id}/approve`, "platform");
    expect(again.status).toBe(409); expect(again.json.error.code).toBe("INVALID_STATE");
    expect((await logs(id, "company.approve")).length).toBe(1);
  });
  test("rejecting: optional reason goes to the log; only a pending request can be rejected", async () => {
    const withReason = await seed("RejectWhy"), plain = await seed("RejectPlain"), active = await seed("RejectActive", "active");
    expect((await call("PATCH", `/api/v1/companies/${withReason}/reject`, "platform", { reason: "Documents do not match" })).json.data.workspace_status).toBe("rejected");
    expect((await logs(withReason, "company.reject"))[0]!.new_value).toEqual({ workspace_status: "rejected", reason: "Documents do not match" });
    expect((await call("PATCH", `/api/v1/companies/${plain}/reject`, "platform")).status).toBe(200); // no body at all
    expect((await logs(plain, "company.reject"))[0]!.new_value).toEqual({ workspace_status: "rejected" });
    expect((await call("PATCH", `/api/v1/companies/${active}/reject`, "platform")).status).toBe(409);
    expect((await call("PATCH", `/api/v1/companies/${withReason}/approve`, "platform")).status).toBe(409); // a rejected request is not approved afterwards
    expect((await call("PATCH", `/api/v1/companies/${plain}/reject`, "platform", { reason: "" })).status).toBe(422);
  });
  test("suspend and re-open; already in that state is a harmless no-op; pending and rejected are not touched by status", async () => {
    const id = await seed("Suspend", "active");
    expect((await call("PATCH", `/api/v1/companies/${id}/status`, "platform", { workspace_status: "suspended" })).json.data.workspace_status).toBe("suspended");
    expect((await call("PATCH", `/api/v1/companies/${id}/status`, "platform", { workspace_status: "suspended" })).status).toBe(200); // same again
    expect((await logs(id, "company.suspend")).length).toBe(1); // ... and not logged twice
    expect((await call("PATCH", `/api/v1/companies/${id}/status`, "platform", { workspace_status: "active" })).json.data.workspace_status).toBe("active");
    expect((await logs(id, "company.activate")).length).toBe(1);
    const pending = await seed("StatusPending"), rejected = await seed("StatusRejected", "rejected");
    for (const target of ["active", "suspended"]) for (const company of [pending, rejected]) expect((await call("PATCH", `/api/v1/companies/${company}/status`, "platform", { workspace_status: target })).status).toBe(409);
    expect(await statusOf(pending)).toBe("pending"); expect(await statusOf(rejected)).toBe("rejected");
    for (const bad of [{ workspace_status: "pending" }, { workspace_status: "rejected" }, { workspace_status: "deleted" }, {}]) expect((await call("PATCH", `/api/v1/companies/${id}/status`, "platform", bad)).status).toBe(422);
    expect((await call("PATCH", "/api/v1/companies/922337203685477580/approve", "platform")).status).toBe(404);
  });
  test("two administrators approving at the same moment: one wins, one is told it is already done", async () => {
    const id = await seed("Race");
    const results = await Promise.all([1, 2, 3].map(() => call("PATCH", `/api/v1/companies/${id}/approve`, "platform")));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect((await logs(id, "company.approve")).length).toBe(1);
  });
  test("if the log cannot be written the change is undone (change and log are one transaction)", async () => {
    const id = await seed("AuditFails");
    const fn = `fail_audit_${run}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON system_log FOR EACH ROW WHEN (NEW.entity_id = '${id}') EXECUTE FUNCTION ${fn}()`);
    try {
      expect((await call("PATCH", `/api/v1/companies/${id}/approve`, "platform")).status).toBe(500);
      expect(await statusOf(id)).toBe("pending");
      expect((await call("PUT", `/api/v1/companies/${id}`, "platform", { company_name: "Changed anyway?" })).status).toBe(500);
      expect((await prisma.company.findUnique({ where: { company_id: BigInt(id) } }))!.company_name).toBe(`AuditFails ${run}`);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER ${fn} ON system_log`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION ${fn}()`);
    }
    expect((await call("PATCH", `/api/v1/companies/${id}/approve`, "platform")).status).toBe(200); // works again once the log works
  });
  test("what other services ask is answered with the new status right away", async () => {
    const id = await seed("Internal", "pending");
    const ask = async () => (await app.handle(new Request(`http://localhost/internal/companies/${id}`, { headers: { "x-internal-token": process.env.INTERNAL_API_TOKEN! } }))).json();
    expect((await ask()).data.workspace_status).toBe("pending");
    await call("PATCH", `/api/v1/companies/${id}/approve`, "platform");
    expect((await ask()).data.workspace_status).toBe("active");
    await call("PATCH", `/api/v1/companies/${id}/status`, "platform", { workspace_status: "suspended" });
    expect((await ask()).data.workspace_status).toBe("suspended");
  });
});
