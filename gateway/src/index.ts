import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

// Which service answers which public path (project PDF, pages 18-26). Anything not listed here is a 404:
// this is the allowlist, and /internal/* is deliberately absent so services' private APIs are never reachable from outside.
const ROUTES: [prefix: string, url: string][] = [
  ["/api/v1/auth", process.env.AUTH_SERVICE_URL ?? "http://127.0.0.1:3002"],
  ["/api/v1/companies", process.env.COMPANY_SERVICE_URL ?? "http://127.0.0.1:3005"],
  ["/api/v1/users", process.env.USER_SERVICE_URL ?? "http://127.0.0.1:3003"],
  ["/api/v1/vehicles", process.env.VEHICLE_SERVICE_URL ?? "http://127.0.0.1:3006"],
  ["/api/v1/vehicle-types", process.env.VEHICLE_SERVICE_URL ?? "http://127.0.0.1:3006"],
  ["/api/v1/gps-devices", process.env.GPS_DEVICE_SERVICE_URL ?? "http://127.0.0.1:3007"],
  ["/api/v1/gps", process.env.GPS_DATA_SERVICE_URL ?? "http://127.0.0.1:3004"],
  ["/api/v1/tracking", process.env.TRACKING_SERVICE_URL ?? "http://127.0.0.1:3008"],
  ["/api/v1/routes", process.env.ROUTE_HISTORY_SERVICE_URL ?? "http://127.0.0.1:3009"],
  ["/api/v1/jobs", process.env.TRANSPORT_SERVICE_URL ?? "http://127.0.0.1:3010"],
  ["/api/v1/driver", process.env.TRANSPORT_SERVICE_URL ?? "http://127.0.0.1:3010"],
  ["/api/v1/alert-rules", process.env.ALERT_SERVICE_URL ?? "http://127.0.0.1:3011"],
  ["/api/v1/geofences", process.env.ALERT_SERVICE_URL ?? "http://127.0.0.1:3011"],
  ["/api/v1/alerts", process.env.ALERT_SERVICE_URL ?? "http://127.0.0.1:3011"],
  ["/api/v1/dashboard", process.env.REPORTING_SERVICE_URL ?? "http://127.0.0.1:3012"],
  ["/api/v1/reports", process.env.REPORTING_SERVICE_URL ?? "http://127.0.0.1:3012"],
  ["/api/v1/integrations", process.env.INTEGRATION_SERVICE_URL ?? "http://127.0.0.1:3013"],
  ["/api/v1/integration-logs", process.env.INTEGRATION_SERVICE_URL ?? "http://127.0.0.1:3013"],
  ["/api/v1/system-logs", process.env.INTEGRATION_SERVICE_URL ?? "http://127.0.0.1:3013"],
];

// Whole path segments only: "/api/v1/gps" must not match "/api/v1/gps-fake".
const upstreamFor = (pathname: string) => ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];

const app = new Elysia()
  .use(cors({ origin: WEB_ORIGIN }))
  .get("/", () => ({ service: "gateway", status: "ok" })) // Docker health check
  .all(
    "/api/v1/*",
    async ({ request, server, set }) => {
      const url = new URL(request.url);
      const upstreamUrl = upstreamFor(url.pathname);
      if (!upstreamUrl) {
        set.status = 404;
        return { success: false, error: { code: "NOT_FOUND", message: "Not found" } };
      }

      // Rebuild the forwarding headers rather than copying the client's: the client IP is set here, never trusted from the caller.
      const headers = new Headers();
      for (const name of ["authorization", "content-type", "user-agent"]) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      headers.set("x-request-id", crypto.randomUUID());
      const ip = server?.requestIP(request)?.address;
      if (ip) headers.set("x-forwarded-for", ip);

      try {
        const upstream = await fetch(`${upstreamUrl}${url.pathname}${url.search}`, {
          method: request.method,
          headers,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
        });
        // Only these response headers are passed on: the type, and what a file download (a CSV report) needs.
        const out = new Headers({ "content-type": upstream.headers.get("content-type") ?? "application/json" });
        for (const name of ["content-disposition", "cache-control"]) {
          const value = upstream.headers.get(name);
          if (value) out.set(name, value);
        }
        return new Response(upstream.body, { status: upstream.status, headers: out });
      } catch {
        set.status = 502;
        return { success: false, error: { code: "UPSTREAM_UNAVAILABLE", message: "Service unavailable" } };
      }
    },
  )
  .listen({
    hostname: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3000),
  });

console.log(`gateway listening on ${app.server?.hostname}:${app.server?.port}`);
