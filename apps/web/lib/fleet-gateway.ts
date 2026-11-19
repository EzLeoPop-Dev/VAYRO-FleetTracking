import "server-only";

import { cookies } from "next/headers";

export async function proxyFleet(request: Request, segments: string[]) {
  const fail = (status: number, code: string) => Response.json({
    success: false,
    error: { code, message: "Fleet request could not be completed" },
    request_id: crypto.randomUUID(),
  }, { status, headers: { "cache-control": "no-store" } });

  const path = segments.join("/");
  const valid = /^(vehicles|vehicle-types)(\/[1-9]\d*)?$/.test(path);
  const drivers = path === "drivers" && request.method === "GET";
  if (!valid && !drivers) return fail(404, "NOT_FOUND");
  const token = (await cookies()).get("vayro_at")?.value;
  if (!token) return fail(401, "UNAUTHORIZED");

  if (request.method !== "GET" && request.headers.get("origin")) {
    try {
      const source = new URL(request.headers.get("origin")!);
      if (!["http:", "https:"].includes(source.protocol) || source.host !== request.headers.get("host")) return fail(403, "FORBIDDEN");
    } catch {
      return fail(403, "FORBIDDEN");
    }
  }

  try {
    const url = new URL(`/api/v1/${drivers ? "users" : path}`, process.env.API_URL ?? "http://127.0.0.1:3001");
    const incoming = new URL(request.url);
    for (const key of ["limit", "offset", "q", "vehicle_status", "is_active"]) {
      const value = incoming.searchParams.get(key);
      if (value !== null) url.searchParams.set(key, value);
    }
    let body: string | undefined;
    if (request.method !== "GET") {
      body = await request.text();
      if (body.length > 16_384) return fail(413, "VALIDATION_ERROR");
    }
    const upstream = await fetch(url, {
      method: request.method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    });
    return new Response(upstream.body, { status: upstream.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return fail(503, "FLEET_UNAVAILABLE");
  }
}
