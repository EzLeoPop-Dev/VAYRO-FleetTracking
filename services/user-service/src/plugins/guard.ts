import { ApiError, type Role } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { resolveCaller } from "../adapters/auth-service";

// Requires a valid bearer token (checked live by auth-service), then provides `me`. Pass roles to restrict access.
export const authed = (...roles: Role[]) =>
  new Elysia().resolve({ as: "scoped" }, async ({ headers }) => {
    const me = await resolveCaller(headers.authorization);
    if (roles.length && !roles.includes(me.role)) throw new ApiError(403, "FORBIDDEN", "Insufficient role");
    return { me };
  });
