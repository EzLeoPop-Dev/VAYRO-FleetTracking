import { ApiError } from "@vayro/service-kit";
import * as users from "../../adapters/user-service";
import type { SessionUser } from "../../adapters/user-service";
import { config } from "../../config/env";
import { audit } from "../../lib/audit";
import { signAccessToken, verifyAccessToken } from "../../lib/jwt";
import { prisma, type Db } from "../../lib/prisma";
import { hashRefreshToken, newRefreshToken } from "../../lib/refresh-token";
import * as sessions from "../session/session.repository";
import { canUseSystem, denyReason, publicUser } from "./auth.policy";

async function issueSession(db: Db, user: SessionUser, ip: string | null, userAgent: string | null) {
  const refresh = newRefreshToken();
  const session = await sessions.create(db, {
    user_id: BigInt(user.user_id),
    refresh_token_hash: hashRefreshToken(refresh),
    expires_at: new Date(Date.now() + config.refreshTtlSeconds * 1000),
    ip_address: ip,
    user_agent: userAgent,
  });
  return {
    access_token: signAccessToken({ sub: user.user_id, role: user.role, cid: user.company_id, sid: String(session.session_id) }),
    refresh_token: refresh,
    token_type: "Bearer" as const,
    expires_in: config.accessTtlSeconds,
  };
}

export async function login(email: string, password: string, ip: string | null, userAgent: string | null) {
  // user-service checks the password (and spends the same time for unknown emails).
  const { valid, user } = await users.verifyCredentials(email.trim().toLowerCase(), password);
  if (!user || !valid) {
    await audit({ companyId: user?.company_id, userId: user?.user_id, action: "auth.login", result: "failure", ip });
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  if (!canUseSystem(user)) {
    await audit({ companyId: user.company_id, userId: user.user_id, action: "auth.login", result: "failure", ip });
    throw denyReason(user);
  }
  const tokens = await issueSession(prisma, user, ip, userAgent);
  await audit({ companyId: user.company_id, userId: user.user_id, action: "auth.login", ip });
  return { ...tokens, user: publicUser(user) };
}

const invalidRefresh = () => new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");

export async function refresh(refreshToken: string, ip: string | null, userAgent: string | null) {
  const hash = hashRefreshToken(refreshToken);
  const known = await sessions.findByHash(prisma, hash);
  const owner = known && (await users.findUser(String(known.user_id)));
  if (!known || !owner) throw invalidRefresh();

  const result = await prisma.$transaction(async (tx) => {
    // Serialize rotations across all of this user's sessions, so a replayed token cannot race a rotation.
    await sessions.lockUser(tx, known.user_id);
    const session = await sessions.findByHash(tx, hash);
    if (!session || session.expires_at <= new Date()) return null;
    if (session.revoked_at || !canUseSystem(owner)) {
      await sessions.revokeAllForUser(tx, known.user_id);
      return { reused: session.revoked_at !== null };
    }
    await sessions.rotate(tx, session.session_id);
    return { tokens: await issueSession(tx, owner, ip, userAgent) };
  });
  if (!result || !("tokens" in result)) {
    if (result?.reused) await audit({ userId: known.user_id, action: "auth.refresh_reuse", result: "failure", ip });
    throw invalidRefresh();
  }
  return result.tokens;
}

// Idempotent; the refresh token itself is the credential, so no bearer token is needed.
export async function logout(refreshToken: string, ip: string | null) {
  const userId = await sessions.revokeByHash(prisma, hashRefreshToken(refreshToken));
  if (userId !== null) await audit({ userId, action: "auth.logout", ip });
}

// Validates a bearer token and re-reads the user, so role/status changes apply immediately
// (suspending a user or workspace takes effect without waiting for the access token to expire).
export async function authenticate(authorization?: string | null): Promise<SessionUser> {
  const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
  const claims = token ? verifyAccessToken(token) : null;
  const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "Missing or invalid access token");
  if (!claims) throw unauthorized();

  const me = await users.findUser(claims.sub);
  if (!me) throw unauthorized();
  if (!canUseSystem(me)) throw denyReason(me);
  if (!(await sessions.findActive(prisma, BigInt(claims.sid), BigInt(me.user_id)))) throw new ApiError(401, "UNAUTHORIZED", "Session expired or revoked");
  return me;
}

export const revokeUserSessions = (userId: string) => sessions.revokeAllForUser(prisma, BigInt(userId));
