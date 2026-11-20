import type { Db, Prisma } from "../../lib/prisma";

// The only place that talks to the transport_jobs table for this module.

export const list = (db: Db, where: Prisma.TransportJobWhereInput, take: number, skip: number) =>
  db.transportJob.findMany({ where, orderBy: [{ scheduled_start_at: { sort: "desc", nulls: "last" } }, { job_id: "desc" }], take, skip });

export const count = (db: Db, where: Prisma.TransportJobWhereInput) => db.transportJob.count({ where });

export const findOne = (db: Db, where: Prisma.TransportJobWhereInput) => db.transportJob.findFirst({ where });

export const create = (db: Db, data: Prisma.TransportJobUncheckedCreateInput) => db.transportJob.create({ data });

export const update = (db: Db, id: bigint, data: Prisma.TransportJobUncheckedUpdateInput) => db.transportJob.update({ where: { job_id: id }, data });

// Transaction-scoped advisory locks (released at commit/rollback). Keys come from lockKeys(), already sorted.
export async function lock(db: Db, keys: string[]) {
  for (const key of keys) await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
}
