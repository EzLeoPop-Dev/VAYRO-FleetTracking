import { ApiError, parseId, type Caller } from "@vayro/service-kit";
import { generateApiKey, permissionsProblem } from "../../domain/api-key";
import { audit } from "../../lib/audit";
import { prisma, type Db, type Prisma } from "../../lib/prisma";
import { publicIntegration, type IntegrationRecord } from "./integrations.model";
import * as integrations from "./integrations.repository";

// Company Admin manages the keys of their own company. Platform Admin may look at any company's keys but not change them.
const scopeFor = (me: Caller, companyFilter?: string): Prisma.ApiIntegrationWhereInput =>
  me.role === "platform_admin" ? (companyFilter ? { company_id: parseId(companyFilter) } : {}) : { company_id: BigInt(me.company_id!) };

async function load(db: Db, me: Caller, id: string): Promise<IntegrationRecord> {
  const row = await integrations.findOne(db, { integration_id: parseId(id), ...scopeFor(me) });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Integration not found");
  return row;
}

export async function listIntegrations(me: Caller, q: { integration_status?: "active" | "revoked" | "disabled"; company_id?: string; limit?: number; offset?: number }) {
  const where: Prisma.ApiIntegrationWhereInput = { ...scopeFor(me, q.company_id), ...(q.integration_status ? { integration_status: q.integration_status } : {}) };
  const limit = q.limit ?? 50, offset = q.offset ?? 0;
  const [rows, total] = await Promise.all([integrations.list(prisma, where, limit, offset), integrations.count(prisma, where)]);
  return { rows: rows.map(publicIntegration), meta: { total, limit, offset } };
}

export async function getIntegration(me: Caller, id: string) {
  return publicIntegration(await load(prisma, me, id));
}

function checkPermissions(list: readonly string[]) {
  const message = permissionsProblem(list);
  if (message) throw new ApiError(422, "VALIDATION_ERROR", message);
}

// The only moment the full key exists: it is returned here and stored only as a hash.
export async function createIntegration(me: Caller, body: { integration_name: string; permissions: string[]; rate_limit_per_minute?: number }, ip: string | null) {
  checkPermissions(body.permissions);
  const key = generateApiKey();
  const row = await prisma.$transaction(async (tx) => {
    const created = await integrations.create(tx, {
      company_id: BigInt(me.company_id!),
      integration_name: body.integration_name.trim(),
      api_key_prefix: key.prefix,
      api_key_hash: key.hash,
      permissions: body.permissions,
      rate_limit_per_minute: body.rate_limit_per_minute ?? null,
      created_by: BigInt(me.user_id),
    });
    await audit({ companyId: created.company_id, userId: me.user_id, action: "integration.create", entityType: "integration", entityId: created.integration_id, newValue: publicIntegration(created), ip }, tx);
    return created;
  });
  return { ...publicIntegration(row), api_key: key.apiKey, api_key_notice: "Store this key now: it is shown only once and cannot be retrieved later." };
}

export async function updateIntegration(me: Caller, id: string, body: { integration_name?: string; permissions?: string[]; rate_limit_per_minute?: number; integration_status?: "active" | "disabled" }, ip: string | null) {
  if (body.permissions) checkPermissions(body.permissions);
  const row = await prisma.$transaction(async (tx) => {
    await integrations.lock(tx, parseId(id));
    const old = await load(tx, me, id);
    if (old.integration_status === "revoked") throw new ApiError(409, "INTEGRATION_REVOKED", "A revoked integration cannot be changed");
    const updated = await integrations.update(tx, old.integration_id, {
      ...(body.integration_name !== undefined ? { integration_name: body.integration_name.trim() } : {}),
      ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
      ...(body.rate_limit_per_minute !== undefined ? { rate_limit_per_minute: body.rate_limit_per_minute } : {}),
      ...(body.integration_status !== undefined ? { integration_status: body.integration_status } : {}),
    });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "integration.update", entityType: "integration", entityId: old.integration_id, oldValue: publicIntegration(old), newValue: publicIntegration(updated), ip }, tx);
    return updated;
  });
  return publicIntegration(row);
}

// A new key replaces the old one immediately; the old key stops working at once.
export async function rotateKey(me: Caller, id: string, ip: string | null) {
  const key = generateApiKey();
  const row = await prisma.$transaction(async (tx) => {
    await integrations.lock(tx, parseId(id));
    const old = await load(tx, me, id);
    if (old.integration_status === "revoked") throw new ApiError(409, "INTEGRATION_REVOKED", "A revoked integration cannot get a new key; create a new integration");
    const updated = await integrations.update(tx, old.integration_id, { api_key_prefix: key.prefix, api_key_hash: key.hash });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "integration.rotate_key", entityType: "integration", entityId: old.integration_id, oldValue: { api_key_prefix: old.api_key_prefix }, newValue: { api_key_prefix: updated.api_key_prefix }, ip }, tx);
    return updated;
  });
  return { ...publicIntegration(row), api_key: key.apiKey, api_key_notice: "Store this key now: it is shown only once and cannot be retrieved later." };
}

export async function revokeIntegration(me: Caller, id: string, ip: string | null) {
  const row = await prisma.$transaction(async (tx) => {
    await integrations.lock(tx, parseId(id));
    const old = await load(tx, me, id);
    if (old.integration_status === "revoked") throw new ApiError(409, "INTEGRATION_REVOKED", "This integration is already revoked");
    const updated = await integrations.update(tx, old.integration_id, { integration_status: "revoked", revoked_at: new Date() });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "integration.revoke", entityType: "integration", entityId: old.integration_id, oldValue: publicIntegration(old), newValue: publicIntegration(updated), ip }, tx);
    return updated;
  });
  return publicIntegration(row);
}
