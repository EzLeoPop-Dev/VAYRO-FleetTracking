import { t } from "elysia";
import { idSchema } from "@vayro/service-kit";

export const roleSchema = t.Union([t.Literal("platform_admin"), t.Literal("company_admin"), t.Literal("dispatcher"), t.Literal("driver")]);
export const companySchema = t.Optional(t.Union([idSchema, t.Null()]));
export const nameSchema = t.String({ minLength: 1, maxLength: 150, pattern: "\\S" });
export const emailSchema = t.String({ maxLength: 150, format: "email" });
export const phoneSchema = t.Optional(t.Union([t.String({ maxLength: 30 }), t.Null()]));
export const profileSchema = t.Object({ full_name: nameSchema, email: t.Optional(emailSchema), phone: phoneSchema });
export const statusSchema = t.Union([t.Literal("active"), t.Literal("inactive"), t.Literal("suspended")]);

// Never includes password_hash; this is the only shape that leaves the service.
export const USER_SELECT = {
  user_id: true,
  company_id: true,
  full_name: true,
  email: true,
  role: true,
  phone: true,
  account_status: true,
} as const;

interface UserRecord {
  user_id: bigint;
  company_id: bigint | null;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  account_status: string;
}

// BIGINT ids go out as strings (not safe as JSON numbers).
export const idOrNull = (id: bigint | null) => (id === null ? null : String(id));

export function publicUser(u: UserRecord) {
  return {
    user_id: String(u.user_id),
    company_id: idOrNull(u.company_id),
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    account_status: u.account_status,
  };
}
