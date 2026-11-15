import { ApiError, type Role } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { authenticate } from "../modules/auth/auth.service";

// Requires a valid bearer token, then provides `me`. Pass roles to restrict access.
export const authed = (...roles: Role[]) =>
  new Elysia().resolve({ as: "scoped" }, async ({ headers }) => {
    const me = await authenticate(headers.authorization);
    if (roles.length && !roles.includes(me.role)) throw new ApiError(403, "FORBIDDEN", "Insufficient role");
    return { me };
  });
