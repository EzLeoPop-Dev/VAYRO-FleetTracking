import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";

process.env.JWT_SECRET ??= "unit-test-secret-not-for-deployment-123456";
process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1/unused";
process.env.USER_SERVICE_URL ??= "http://127.0.0.1:1";
process.env.COMPANY_SERVICE_URL ??= "http://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN ??= "unit-test-internal-token-not-for-deployment-123456";
const { signAccessToken, verifyAccessToken } = await import("../src/lib/jwt");
const { hashRefreshToken, newRefreshToken } = await import("../src/lib/refresh-token");
const { config } = await import("../src/config/env");
const claims = { sub: "1", sid: "2", role: "driver", cid: "3" };

function signed(payload: object, header = { alg: "HS256", typ: "JWT" }) {
  const data = [header, payload].map(x => Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");
  return `${data}.${createHmac("sha256", config.jwtSecret).update(data).digest("base64url")}`;
}

describe("Authentication tokens", () => {
  test("round trip binds a token to a session", () => {
    expect(verifyAccessToken(signAccessToken(claims))).toEqual(claims);
  });
  test("tampering, wrong algorithm and malformed input are rejected", () => {
    const token = signAccessToken(claims);
    for (const bad of ["", "a.b.c", token + "x", signed(claims, { alg: "none", typ: "JWT" })]) {
      expect(verifyAccessToken(bad)).toBeNull();
    }
  });
  test("expiry and missing or invalid session claims are rejected", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    for (const payload of [
      { ...claims, exp: exp - 120 }, { ...claims, exp: Math.floor(Date.now() / 1000) },
      { ...claims, exp: "forever" }, { ...claims, exp, sid: undefined },
      { ...claims, exp, sid: "0" }, { ...claims, exp, sub: "abc" },
      { ...claims, exp, role: "root" }, { ...claims, exp, cid: {} },
    ]) expect(verifyAccessToken(signed(payload))).toBeNull();
  });
  test("refresh secrets are stored as hashes", () => {
    const refresh = newRefreshToken();
    expect(newRefreshToken()).not.toBe(refresh);
    expect(hashRefreshToken(refresh)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken(refresh)).not.toBe(refresh);
  });
  test("invalid token TTL fails at startup", () => {
    const result = Bun.spawnSync([process.execPath, "-e", "await import('./src/config/env.ts')"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: { ...process.env, ACCESS_TOKEN_TTL_SECONDS: "NaN" },
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("ACCESS_TOKEN_TTL_SECONDS must be an integer");
  });
});
