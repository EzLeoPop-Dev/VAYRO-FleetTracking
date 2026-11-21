import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";
import { MAX_RATE_LIMIT_PER_MINUTE, PERMISSIONS } from "../../domain/api-key";

const permission = t.Union(PERMISSIONS.map((p) => t.Literal(p)));
const name = t.String({ minLength: 1, maxLength: 120, pattern: "\\S" });
const rateLimit = t.Integer({ minimum: 1, maximum: MAX_RATE_LIMIT_PER_MINUTE });

// company_id and created_by come from the signed-in user, never from the body.
export const createBody = t.Object(
  { integration_name: name, permissions: t.Array(permission, { minItems: 1, maxItems: PERMISSIONS.length }), rate_limit_per_minute: t.Optional(rateLimit) },
  { additionalProperties: false },
);
// PUT: edit name, permissions, rate limit, or switch the key off/on (active <-> disabled). Revoking has its own endpoint and is final.
export const updateBody = t.Object(
  {
    integration_name: t.Optional(name),
    permissions: t.Optional(t.Array(permission, { minItems: 1, maxItems: PERMISSIONS.length })),
    rate_limit_per_minute: t.Optional(rateLimit),
    integration_status: t.Optional(t.Union([t.Literal("active"), t.Literal("disabled")])),
  },
  { additionalProperties: false, minProperties: 1 },
);
export const idParams = t.Object({ id: idSchema });
export const listQuery = t.Object({
  integration_status: t.Optional(t.Union([t.Literal("active"), t.Literal("revoked"), t.Literal("disabled")])),
  company_id: t.Optional(idSchema), // Platform Admin only; a Company Admin is always limited to their own company
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
});

export interface IntegrationRecord {
  integration_id: bigint;
  company_id: bigint;
  integration_name: string;
  api_key_prefix: string;
  permissions: unknown;
  rate_limit_per_minute: bigint | null;
  integration_status: string;
  created_by: bigint;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

const isoOrNull = (d: Date | null) => (d === null ? null : d.toISOString());

// Never includes api_key_hash. The full key is returned once, by create and rotate-key, as `api_key`.
export const publicIntegration = (i: IntegrationRecord) => ({
  integration_id: String(i.integration_id),
  company_id: String(i.company_id),
  integration_name: i.integration_name,
  api_key_prefix: i.api_key_prefix,
  permissions: i.permissions as string[],
  rate_limit_per_minute: i.rate_limit_per_minute === null ? null : Number(i.rate_limit_per_minute),
  integration_status: i.integration_status,
  created_by: String(i.created_by),
  created_at: i.created_at.toISOString(),
  last_used_at: isoOrNull(i.last_used_at),
  revoked_at: isoOrNull(i.revoked_at),
});
