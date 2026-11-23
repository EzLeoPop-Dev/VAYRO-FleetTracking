import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";

// ---- request schemas ----
export const STATUSES = ["pending", "active", "suspended", "rejected"] as const;
export type WorkspaceStatus = (typeof STATUSES)[number];

const nullableText = (maxLength: number) => t.Optional(t.Union([t.String({ maxLength }), t.Null()]));

export const idParams = t.Object({ id: idSchema });
export const listQuery = t.Object({
  q: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  status: t.Optional(t.Union(STATUSES.map((s) => t.Literal(s)))),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 100000, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
});
// Only contact and name fields can be edited here. The workspace status changes only through approve / reject / status.
export const updateBody = t.Object(
  {
    company_name: t.Optional(t.String({ minLength: 1, maxLength: 150, pattern: "\\S" })),
    contact_name: nullableText(100),
    contact_email: t.Optional(t.String({ minLength: 3, maxLength: 150, format: "email" })),
    contact_phone: nullableText(30),
  },
  { additionalProperties: false, minProperties: 1 },
);
export const rejectBody = t.Optional(t.Object({ reason: t.Optional(t.String({ minLength: 1, maxLength: 255 })) }, { additionalProperties: false }));
export const statusBody = t.Object({ workspace_status: t.Union([t.Literal("active"), t.Literal("suspended")]) }, { additionalProperties: false });

// ---- response mapping (BIGINT ids go out as strings) ----
export const COMPANY_FULL = {
  company_id: true,
  company_name: true,
  workspace_status: true,
  contact_name: true,
  contact_email: true,
  contact_phone: true,
  created_at: true,
  updated_at: true,
} as const;

interface CompanyRecord {
  company_id: bigint; company_name: string; workspace_status: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null; created_at: Date; updated_at: Date;
}

export function publicCompany(c: CompanyRecord) {
  return {
    company_id: String(c.company_id),
    company_name: c.company_name,
    workspace_status: c.workspace_status,
    contact_name: c.contact_name,
    contact_email: c.contact_email,
    contact_phone: c.contact_phone,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  };
}
