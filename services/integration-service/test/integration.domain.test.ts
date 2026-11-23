import { describe, expect, test } from "bun:test";
import { DEFAULT_RATE_LIMIT_PER_MINUTE, effectiveRateLimit, generateApiKey, hashSecret, loggablePath, parseApiKey, permissionsProblem, secretMatches } from "../src/domain/api-key";
import { RateLimiter } from "../src/domain/rate-limit";
import { mergeNewestFirst } from "../src/domain/system-logs";

describe("api keys", () => {
  test("a generated key parses back to its prefix and a secret that matches the stored hash", () => {
    const { apiKey, prefix, hash } = generateApiKey();
    const parsed = parseApiKey(apiKey)!;
    expect(parsed.prefix).toBe(prefix);
    expect(prefix.length).toBeLessThanOrEqual(20);
    expect(secretMatches(parsed.secret, hash)).toBe(true);
  });
  test("the hash is not the key and not the secret", () => {
    const { apiKey, hash } = generateApiKey();
    expect(apiKey.includes(hash)).toBe(false);
    expect(hash).toHaveLength(64);
  });
  test("two keys are never equal; a wrong secret or a damaged hash does not match", () => {
    const a = generateApiKey(), b = generateApiKey();
    expect(a.apiKey).not.toBe(b.apiKey);
    expect(secretMatches(parseApiKey(b.apiKey)!.secret, a.hash)).toBe(false);
    expect(secretMatches("x".repeat(43), "not-hex")).toBe(false);
  });
  test("malformed keys are refused", () => {
    expect(parseApiKey("")).toBeNull();
    expect(parseApiKey("vyr_1a2b3c4d")).toBeNull();
    expect(parseApiKey("vyr_1a2b3c4d.short")).toBeNull();
    expect(parseApiKey("abc_1a2b3c4d." + "A".repeat(43))).toBeNull();
    expect(parseApiKey("vyr_ZZZZZZZZ." + "A".repeat(43))).toBeNull();
  });
  test("hashing is stable", () => {
    expect(hashSecret("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("permissions and limits", () => {
  test("only known permissions, no repeats, not empty", () => {
    expect(permissionsProblem(["vehicles:read", "gps:read"])).toBeNull();
    expect(permissionsProblem([])).not.toBeNull();
    expect(permissionsProblem(["vehicles:write"])).toContain("vehicles:write");
    expect(permissionsProblem(["gps:read", "gps:read"])).not.toBeNull();
  });
  test("a missing rate limit means the platform default", () => {
    expect(effectiveRateLimit(null)).toBe(DEFAULT_RATE_LIMIT_PER_MINUTE);
    expect(effectiveRateLimit(120n)).toBe(120);
  });
  test("request logs keep the path only", () => {
    expect(loggablePath("/api/v1/vehicles?api_key=secret&page=2")).toBe("/api/v1/vehicles");
    expect(loggablePath("/a#frag")).toBe("/a");
    expect(loggablePath("/" + "x".repeat(400))).toHaveLength(255);
  });
});

describe("rate limiter", () => {
  test("allows up to the limit in a window, then refuses until it resets", () => {
    const rl = new RateLimiter(60_000);
    expect(rl.hit("k", 2, 0).allowed).toBe(true);
    const second = rl.hit("k", 2, 1000);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    const third = rl.hit("k", 2, 2000);
    expect(third.allowed).toBe(false);
    expect(third.resetAt).toBe(60_000);
    expect(rl.hit("k", 2, 60_000).allowed).toBe(true);
  });
  test("keys are counted separately", () => {
    const rl = new RateLimiter(60_000);
    rl.hit("a", 1, 0);
    expect(rl.hit("a", 1, 1).allowed).toBe(false);
    expect(rl.hit("b", 1, 1).allowed).toBe(true);
  });
});

describe("system log merge", () => {
  const row = (source: string, at: string, id: string) => ({ source, created_at: at, system_log_id: id });
  test("newest first across sources, then the requested page", () => {
    const a = [row("a", "2026-11-18T10:03:00Z", "3"), row("a", "2026-11-18T10:01:00Z", "1")];
    const b = [row("b", "2026-11-18T10:02:00Z", "9"), row("b", "2026-11-18T10:00:00Z", "8")];
    expect(mergeNewestFirst([a, b], 0, 3).map((r) => r.system_log_id)).toEqual(["3", "9", "1"]);
    expect(mergeNewestFirst([a, b], 1, 2).map((r) => r.system_log_id)).toEqual(["9", "1"]);
    expect(mergeNewestFirst([a, b], 3, 10).map((r) => r.system_log_id)).toEqual(["8"]);
  });
  test("a source with no rows changes nothing", () => {
    expect(mergeNewestFirst([[], [row("b", "2026-11-18T10:00:00Z", "1")]], 0, 5)).toHaveLength(1);
  });
});
