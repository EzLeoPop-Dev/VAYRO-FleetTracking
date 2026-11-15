import { timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { ApiError } from "./http";

const HEADER = "x-internal-token";

// Guards /internal/* routes. Only other VAYRO services hold the token; the gateway never proxies these paths.
export const internalGuard = (token: string) =>
  new Elysia({ name: "internal-guard", seed: "internal" }).onBeforeHandle({ as: "scoped" }, ({ request }) => {
    const given = Buffer.from(request.headers.get(HEADER) ?? "");
    const expected = Buffer.from(token);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new ApiError(401, "UNAUTHORIZED", "Internal credentials required");
  });

export interface InternalResponse<T = any> {
  status: number;
  body: T;
}

// Minimal JSON client for service-to-service calls. A network failure or timeout becomes 503;
// callers decide what a non-2xx status from the other service means.
export function internalClient(baseUrl: string, token: string, timeoutMs = 3000) {
  return async function call<T = any>(method: "GET" | "POST", path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<InternalResponse<T>> {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { [HEADER]: token, ...(opts.body !== undefined ? { "content-type": "application/json" } : {}), ...opts.headers },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.json().catch(() => null);
      return { status: response.status, body };
    } catch {
      throw new ApiError(503, "UPSTREAM_UNAVAILABLE", "A required service is unavailable");
    }
  };
}
export type InternalClient = ReturnType<typeof internalClient>;
