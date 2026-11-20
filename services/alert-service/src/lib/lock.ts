import type { Db } from "./prisma";

// Transaction-scoped advisory lock (released at commit/rollback): serializes work on one key, e.g. one vehicle.
export async function advisoryLock(db: Db, key: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
}
