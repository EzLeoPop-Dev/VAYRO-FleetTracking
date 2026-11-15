import { Elysia } from "elysia";
import { ApiError } from "./http";
import { parseId } from "./ids";
import type { InternalClient } from "./internal";

export type Role = "platform_admin" | "company_admin" | "dispatcher" | "driver";
export type CallerRole = Role | "gps_device";

// Who is calling. Resolved by auth-service (human users) or by a device credential (GPS devices).
export interface Identity {
  role: CallerRole;
  company_id: string | null;
  user_id?: string;
  device_code?: string;
}

// A signed-in human user as auth-service reports it (status already checked as usable).
export interface Caller extends Identity {
  role: Role;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  account_status: string;
  workspace_status: string | null;
}

// Asks auth-service to validate a bearer token: signature, live session, and current user/workspace status.
export function authResolver(auth: InternalClient) {
  return async function resolve(authorization: string | null | undefined): Promise<Caller> {
    if (!authorization) throw new ApiError(401, "UNAUTHORIZED", "Missing or invalid access token");
    const { status, body } = await auth("GET", "/internal/introspect", { headers: { authorization } });
    if (status === 200 && body?.data) return body.data as Caller;
    if (status === 401 || status === 403) throw new ApiError(status, body?.error?.code ?? "UNAUTHORIZED", body?.error?.message ?? "Unauthorized");
    throw new ApiError(502, "UPSTREAM_ERROR", "Authentication service returned an unexpected response");
  };
}

export function requireRole(identity: Identity, ...roles: CallerRole[]) {
  if (!roles.includes(identity.role)) throw new ApiError(403, "FORBIDDEN", "Insufficient role");
}

// Prisma `where` fragment that keeps a query inside the caller's company.
// Platform Admins see everything unless they pass an explicit company_id.
export function companyScope(identity: Identity, requested?: string): { company_id?: bigint } {
  const requestedId = requested ? parseId(requested) : undefined;
  if (identity.role === "platform_admin") return requestedId === undefined ? {} : { company_id: requestedId };
  if (identity.company_id === null) throw new ApiError(403, "FORBIDDEN", "Caller has no company");
  if (requestedId !== undefined && requestedId !== BigInt(identity.company_id)) throw new ApiError(403, "FORBIDDEN", "Cannot access another company");
  return { company_id: BigInt(identity.company_id) };
}

// Route guard for protected public endpoints: `.use(authed("company_admin"))` makes `me` available in handlers.
// Build it once per service from that service's resolver: `export const authed = createAuthed(resolveCaller)`.
export const createAuthed = (resolve: ReturnType<typeof authResolver>) => (...roles: Role[]) =>
  new Elysia().resolve({ as: "scoped" }, async ({ headers }) => {
    const me = await resolve(headers.authorization);
    if (roles.length && !roles.includes(me.role)) throw new ApiError(403, "FORBIDDEN", "Insufficient role");
    return { me };
  });
