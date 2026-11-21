import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// API keys look like  vyr_1a2b3c4d.<43 url-safe characters>
//   prefix  = "vyr_" + 8 hex characters: stored in clear (api_key_prefix) to recognise a key in a list, never a secret
//   secret  = 32 random bytes: shown once, stored only as a SHA-256 hash (api_key_hash)
// The secret is long and random, so a plain SHA-256 is enough (a password-style slow hash is for guessable secrets).

export const PERMISSIONS = ["vehicles:read", "tracking:read", "gps:read", "routes:read", "jobs:read", "alerts:read", "reports:read"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
export const MAX_RATE_LIMIT_PER_MINUTE = 10000;

export interface GeneratedKey { apiKey: string; prefix: string; hash: string }

export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

export function generateApiKey(): GeneratedKey {
  const prefix = `vyr_${randomBytes(4).toString("hex")}`;
  const secret = randomBytes(32).toString("base64url");
  return { apiKey: `${prefix}.${secret}`, prefix, hash: hashSecret(secret) };
}

const KEY_FORMAT = /^(vyr_[0-9a-f]{8})\.([A-Za-z0-9_-]{43})$/;
export function parseApiKey(raw: string): { prefix: string; secret: string } | null {
  const match = KEY_FORMAT.exec(raw);
  return match ? { prefix: match[1]!, secret: match[2]! } : null;
}

// Constant-time comparison of the secret against a stored hash.
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex"), b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Allowed permissions only, each once. Returns a message when the list is unusable.
export function permissionsProblem(list: readonly string[]): string | null {
  if (list.length === 0) return "permissions must not be empty";
  const unknown = list.filter((p) => !(PERMISSIONS as readonly string[]).includes(p));
  if (unknown.length > 0) return `Unknown permission: ${unknown.join(", ")}`;
  if (new Set(list).size !== list.length) return "permissions must not repeat";
  return null;
}

export const effectiveRateLimit = (stored: bigint | number | null | undefined) => (stored === null || stored === undefined ? DEFAULT_RATE_LIMIT_PER_MINUTE : Number(stored));

// Request logs never keep the query string (it can carry tokens or filters) and are cut to the column size.
export function loggablePath(endpoint: string): string {
  const path = endpoint.split("?")[0]!.split("#")[0]!;
  return path.slice(0, 255);
}
