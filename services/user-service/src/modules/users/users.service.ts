import { ApiError, companyScope, parseId, type Caller } from "@vayro/service-kit";
import { revokeSessions } from "../../adapters/auth-service";
import { companyExists } from "../../adapters/company-service";
import { audit } from "../../lib/audit";
import { hashPassword } from "../../lib/password";
import { prisma, type Db } from "../../lib/prisma";
import { idOrNull, publicUser } from "./users.model";
import * as users from "./users.repository";

type Role = Caller["role"];
type Status = "active" | "inactive" | "suspended";

// Which company a user ends up in, given the caller's rights and the requested role.
async function companyForRole(me: Caller, role: Role, requested: string | null | undefined, existing?: bigint | null) {
  if (me.role !== "platform_admin") {
    if (role === "platform_admin" || (requested !== undefined && requested !== me.company_id)) {
      throw new ApiError(403, "FORBIDDEN", "Cannot grant platform privileges or change workspace");
    }
    return BigInt(me.company_id!);
  }
  const wanted = requested == null ? requested : parseId(requested);
  const companyId = wanted === undefined ? (role === "platform_admin" ? null : existing) : wanted;
  if (role === "platform_admin") {
    if (companyId != null) throw new ApiError(422, "VALIDATION_ERROR", "Platform Admin must have a null company_id");
    return null;
  }
  if (!companyId) throw new ApiError(422, "VALIDATION_ERROR", "Company roles require company_id");
  if (existing && existing !== companyId) throw new ApiError(422, "VALIDATION_ERROR", "Changing a user's existing workspace is not supported");
  if (!(await companyExists(String(companyId)))) throw new ApiError(422, "VALIDATION_ERROR", "Company does not exist");
  return companyId;
}

// Locks the row, then reads it inside the given company scope.
async function target(db: Db, scope: { company_id?: bigint }, id: string) {
  const userId = parseId(id);
  await users.lock(db, userId);
  const row = await users.findOne(db, { user_id: userId, ...scope });
  if (!row) throw new ApiError(404, "NOT_FOUND", "User not found");
  return row;
}

const cleanPhone = (phone: string | null | undefined) => phone?.trim() || null;

export async function listUsers(me: Caller, q: { company_id?: string; limit?: number; offset?: number }) {
  const rows = await users.list(prisma, companyScope(me, q.company_id), q.limit ?? 50, q.offset ?? 0);
  return rows.map(publicUser);
}

export async function getUser(me: Caller, id: string) {
  const row = await users.findOne(prisma, { user_id: parseId(id), ...companyScope(me) });
  if (!row) throw new ApiError(404, "NOT_FOUND", "User not found");
  return publicUser(row);
}

export async function getProfile(me: Caller) {
  const row = await users.findOne(prisma, { user_id: BigInt(me.user_id) });
  if (!row) throw new ApiError(404, "NOT_FOUND", "User not found");
  return publicUser(row);
}

interface ProfileInput { full_name: string; email?: string; phone?: string | null }

async function saveProfile(me: Caller, id: string, body: ProfileInput, ip: string | null, action: "user.update" | "user.update_self") {
  const row = await prisma.$transaction(async (tx) => {
    const old = await target(tx, action === "user.update_self" ? {} : companyScope(me), id);
    const updated = await users.update(tx, old.user_id, {
      full_name: body.full_name.trim(),
      email: body.email?.toLowerCase() ?? old.email,
      phone: body.phone === undefined ? old.phone : cleanPhone(body.phone),
    });
    await audit({ companyId: old.company_id, userId: me.user_id, action, entityType: "user", entityId: old.user_id,
      oldValue: publicUser(old), newValue: publicUser(updated), ip }, tx);
    return updated;
  });
  return publicUser(row);
}

export const updateSelf = (me: Caller, body: ProfileInput, ip: string | null) => saveProfile(me, me.user_id, body, ip, "user.update_self");
export const updateUser = (me: Caller, id: string, body: ProfileInput, ip: string | null) => saveProfile(me, id, body, ip, "user.update");

export async function createUser(me: Caller, body: ProfileInput & { email: string; password: string; role: Role; company_id?: string | null }, ip: string | null) {
  const passwordHash = await hashPassword(body.password);
  const row = await prisma.$transaction(async (tx) => {
    const companyId = await companyForRole(me, body.role, body.company_id);
    const created = await users.create(tx, {
      company_id: companyId,
      full_name: body.full_name.trim(),
      email: body.email.toLowerCase(),
      password_hash: passwordHash,
      role: body.role,
      phone: cleanPhone(body.phone),
    });
    await audit({ companyId, userId: me.user_id, action: "user.create", entityType: "user", entityId: created.user_id, newValue: publicUser(created), ip }, tx);
    return created;
  });
  return publicUser(row);
}

export async function changeRole(me: Caller, id: string, body: { role: Role; company_id?: string | null }, ip: string | null) {
  if (id === me.user_id) throw new ApiError(409, "CONFLICT", "You cannot change your own role");
  const row = await prisma.$transaction(async (tx) => {
    const old = await target(tx, companyScope(me), id);
    const companyId = await companyForRole(me, body.role, body.company_id, old.company_id);
    const updated = await users.update(tx, old.user_id, { role: body.role, company_id: companyId });
    await audit({ companyId: old.company_id ?? companyId, userId: me.user_id, action: "user.change_role", entityType: "user", entityId: old.user_id,
      oldValue: { role: old.role, company_id: idOrNull(old.company_id) }, newValue: { role: updated.role, company_id: idOrNull(companyId) }, ip }, tx);
    return updated;
  });
  return publicUser(row);
}

export async function changeStatus(me: Caller, id: string, status: Status, ip: string | null) {
  if (id === me.user_id) throw new ApiError(409, "CONFLICT", "You cannot change your own status");
  const row = await prisma.$transaction(async (tx) => {
    const old = await target(tx, companyScope(me), id);
    const updated = await users.update(tx, old.user_id, { account_status: status });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "user.change_status", entityType: "user", entityId: old.user_id,
      oldValue: { account_status: old.account_status }, newValue: { account_status: updated.account_status }, ip }, tx);
    return updated;
  });
  // Sessions live in auth-service's database, so they are revoked after the status change commits.
  if (status !== "active") await revokeSessions(String(row.user_id));
  return publicUser(row);
}
