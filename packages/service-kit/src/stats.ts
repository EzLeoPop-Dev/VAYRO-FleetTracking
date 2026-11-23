import { ApiError } from "./http";

// Helpers for the read-only /internal/stats/* endpoints that reporting-service calls.

// Every possible key is present, even with zero rows: a missing key would look like "not counted" instead of "none".
export function zeroFilled<K extends string>(keys: readonly K[], found: Iterable<readonly [string, number]>): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const [key, count] of found) if (key in out) out[key as K] += count;
  return out;
}

export const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

// Optional time window for a stats query. Both ends are optional, and from must not be after to.
export function optionalWindow(from?: string, to?: string): { gte?: Date; lte?: Date } {
  const window = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  if (window.gte && window.lte && window.gte > window.lte) throw new ApiError(422, "VALIDATION_ERROR", "from must not be after to");
  return window;
}

// "1,2,3" -> [1n, 2n, 3n]; empty or missing -> undefined. Each id must be a valid BIGINT, at most `max` of them.
export function parseIdList(csv: string | undefined, parse: (v: string) => bigint, max = 100): bigint[] | undefined {
  if (!csv) return undefined;
  const parts = csv.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length > max) throw new ApiError(422, "VALIDATION_ERROR", `At most ${max} ids per call`);
  return parts.map(parse);
}
