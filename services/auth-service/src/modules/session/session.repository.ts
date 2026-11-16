import type { Db } from "../../lib/prisma";

// The only place that talks to auth_sessions.

export const create = (db: Db, data: { user_id: bigint; refresh_token_hash: string; expires_at: Date; ip_address: string | null; user_agent: string | null }) =>
  db.authSession.create({ data, select: { session_id: true } });

export const findByHash = (db: Db, hash: string) => db.authSession.findUnique({ where: { refresh_token_hash: hash } });

export const findActive = (db: Db, sessionId: bigint, userId: bigint) =>
  db.authSession.findFirst({ where: { session_id: sessionId, user_id: userId, revoked_at: null, expires_at: { gt: new Date() } }, select: { session_id: true } });

// Serializes refresh rotations for one user, including replay revocation.
export const lockUser = (db: Db, userId: bigint) => db.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(${userId})) AS l`;

export const rotate = (db: Db, sessionId: bigint) => db.authSession.update({ where: { session_id: sessionId }, data: { revoked_at: new Date(), last_used_at: new Date() } });

export const revokeAllForUser = async (db: Db, userId: bigint) =>
  (await db.authSession.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } })).count;

// Idempotent: returns the owner of the session that was revoked, or null if nothing was active.
export async function revokeByHash(db: Db, hash: string) {
  const session = await db.authSession.findFirst({ where: { refresh_token_hash: hash, revoked_at: null }, select: { session_id: true, user_id: true } });
  if (!session) return null;
  const { count } = await db.authSession.updateMany({ where: { session_id: session.session_id, revoked_at: null }, data: { revoked_at: new Date() } });
  return count > 0 ? session.user_id : null;
}
