// Runs the real registration use case against company_db, with user-service replaced by a fake.
// Needs DATABASE_URL (company_db). Fixtures use unique e-mails per run and are kept (the failed ones are removed by the use case).
import { describe, expect, test } from "bun:test";
import { ApiError } from "@vayro/service-kit";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the company_db connection string");
process.env.AUTH_SERVICE_URL ??= "http://127.0.0.1:1";
process.env.USER_SERVICE_URL ??= "http://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN ??= "unit-test-internal-token-not-for-deployment-123456";
const { register } = await import("../src/modules/companies/companies.service");
const { prisma } = await import("../src/lib/prisma");
type AdminDirectory = import("../src/adapters/user-service").AdminDirectory;

const run = crypto.randomUUID().slice(0, 8);
const input = (n: string) => ({ company_name: `Register test ${run} ${n}`, contact_email: `reg-${run}-${n}@example.test`, admin_full_name: "Test Admin", admin_email: `admin-${run}-${n}@example.test`, admin_password: "Test-only-password-1" });
const stored = (n: string) => prisma.company.findUnique({ where: { contact_email: input(n).contact_email } });
const down = () => new ApiError(503, "UPSTREAM_UNAVAILABLE", "A required service is unavailable");

// A user-service that behaves as told: what create does, and what a later lookup says.
function fake(create: "ok" | "lost-reply" | "refused" | "email-taken", lookup: "found" | "missing" | "down") {
  const calls = { create: 0, exists: 0 };
  const admins: AdminDirectory = {
    async create() {
      calls.create++;
      if (create === "lost-reply" || create === "refused") throw down();
      if (create === "email-taken") throw new ApiError(409, "CONFLICT", "Resource already exists");
    },
    async exists() {
      calls.exists++;
      if (lookup === "down") throw down();
      return lookup === "found";
    },
  };
  return { admins, calls };
}

describe("company registration across two services", () => {
  test("normal case: company and admin are created, the lookup is never needed", async () => {
    const { admins, calls } = fake("ok", "found");
    const r = await register(input("ok"), null, admins);
    expect(r.workspace_status).toBe("pending"); expect(r.company_id).toBeString();
    expect(calls).toEqual({ create: 1, exists: 0 });
    expect(await stored("ok")).not.toBeNull();
  });
  test("the admin was created but the reply was lost: the company is kept and registration succeeds", async () => {
    const { admins, calls } = fake("lost-reply", "found");
    const r = await register(input("lost"), null, admins);
    expect(r.workspace_status).toBe("pending");
    expect(calls).toEqual({ create: 1, exists: 1 }); // asked once, never created a second admin
    expect((await stored("lost"))?.company_name).toBe(input("lost").company_name);
  });
  test("the admin really was not created: the company is removed again and the original error is reported", async () => {
    const { admins, calls } = fake("refused", "missing");
    await expect(register(input("refused"), null, admins)).rejects.toMatchObject({ status: 503, code: "UPSTREAM_UNAVAILABLE" });
    expect(calls).toEqual({ create: 1, exists: 1 });
    expect(await stored("refused")).toBeNull();
    // the e-mail is free again, so the client can simply try again
    expect((await register(input("refused"), null, fake("ok", "found").admins)).workspace_status).toBe("pending");
  });
  test("the admin's e-mail belongs to someone else: 409, and no company is left behind", async () => {
    const { admins } = fake("email-taken", "missing");
    await expect(register(input("taken"), null, admins)).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(await stored("taken")).toBeNull();
  });
  test("cannot tell whether the admin exists: the company is kept (never deleted on a guess) and the answer is 503", async () => {
    const { admins, calls } = fake("lost-reply", "down");
    await expect(register(input("unknown"), null, admins)).rejects.toMatchObject({ status: 503, code: "REGISTRATION_UNCONFIRMED" });
    expect(calls).toEqual({ create: 1, exists: 1 });
    expect((await stored("unknown"))?.workspace_status).toBe("pending");
  });
  test("the same company contact e-mail cannot register twice", async () => {
    await expect(register(input("ok"), null, fake("ok", "found").admins)).rejects.toMatchObject({ code: "P2002" });
  });
});
