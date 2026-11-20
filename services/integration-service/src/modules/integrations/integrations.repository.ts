import type { Db, Prisma } from "../../lib/prisma";

export const list = (db: Db, where: Prisma.ApiIntegrationWhereInput, take: number, skip: number) =>
  db.apiIntegration.findMany({ where, orderBy: { integration_id: "desc" }, take, skip });
export const count = (db: Db, where: Prisma.ApiIntegrationWhereInput) => db.apiIntegration.count({ where });
export const findOne = (db: Db, where: Prisma.ApiIntegrationWhereInput) => db.apiIntegration.findFirst({ where });
export const findByPrefix = (db: Db, prefix: string) => db.apiIntegration.findMany({ where: { api_key_prefix: prefix } });
export const create = (db: Db, data: Prisma.ApiIntegrationUncheckedCreateInput) => db.apiIntegration.create({ data });
export const update = (db: Db, id: bigint, data: Prisma.ApiIntegrationUncheckedUpdateInput) => db.apiIntegration.update({ where: { integration_id: id }, data });
export const touch = (db: Db, id: bigint, at: Date) => db.apiIntegration.update({ where: { integration_id: id }, data: { last_used_at: at } });

// Serializes changes to one integration (rotate, revoke, edit) so two requests cannot interleave.
export async function lock(db: Db, id: bigint) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`integration:${id}`}::text, 0))`;
}
