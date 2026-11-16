// Session revoke towards auth-service: tried again when it is briefly unavailable, and honest about the result.
// No database or network needed: the call to auth-service is a fake.
import { describe, expect, test } from "bun:test";

process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1/unused";
process.env.AUTH_SERVICE_URL ??= "http://127.0.0.1:1";
process.env.COMPANY_SERVICE_URL ??= "http://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN ??= "unit-test-internal-token-not-for-deployment-123456";
const { revokeSessions } = await import("../src/adapters/auth-service");
type Call = Parameters<typeof revokeSessions>[1];

// Answers with the given outcomes in order: a number is an HTTP status, "throw" is a network failure.
function script(...outcomes: (number | "throw")[]) {
  const seen: { path: string; body: unknown }[] = [];
  const call = (async (_method: string, path: string, opts?: { body?: unknown }) => {
    seen.push({ path, body: opts?.body });
    const next = outcomes[Math.min(seen.length - 1, outcomes.length - 1)]!;
    if (next === "throw") throw new Error("connection refused");
    return { status: next, body: null };
  }) as unknown as Call;
  return { call, seen };
}

describe("revoking a user's sessions", () => {
  test("one call when auth-service answers", async () => {
    const { call, seen } = script(200);
    expect(await revokeSessions("42", call, [0, 0])).toBe(true);
    expect(seen).toEqual([{ path: "/internal/sessions/revoke", body: { user_id: "42" } }]);
  });
  test("tries again after a failure or an error status, and succeeds when auth-service is back", async () => {
    const { call, seen } = script("throw", 503, 200);
    expect(await revokeSessions("42", call, [0, 0])).toBe(true);
    expect(seen.length).toBe(3);
  });
  test("gives up after the last try and says so, so the caller can refuse to continue", async () => {
    const down = script("throw");
    expect(await revokeSessions("42", down.call, [0, 0])).toBe(false);
    expect(down.seen.length).toBe(3); // first try + two retries
    const refused = script(500);
    expect(await revokeSessions("42", refused.call, [0])).toBe(false);
    expect(refused.seen.length).toBe(2);
  });
});
