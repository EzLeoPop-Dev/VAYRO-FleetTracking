import type { Db, Prisma } from "../../lib/prisma";

export const list = (db: Db, where: Prisma.GeofenceWhereInput, take: number, skip: number) => db.geofence.findMany({ where, orderBy: { geofence_id: "asc" }, take, skip });
export const count = (db: Db, where: Prisma.GeofenceWhereInput) => db.geofence.count({ where });
export const activeFor = (db: Db, companyId: bigint) => db.geofence.findMany({ where: { company_id: companyId, geofence_status: "active" } });
export const findOne = (db: Db, id: bigint, companyId: bigint) => db.geofence.findFirst({ where: { geofence_id: id, company_id: companyId } });
export const create = (db: Db, data: Prisma.GeofenceUncheckedCreateInput) => db.geofence.create({ data });
export const update = (db: Db, id: bigint, data: Prisma.GeofenceUncheckedUpdateInput) => db.geofence.update({ where: { geofence_id: id }, data });
export const remove = (db: Db, id: bigint) => db.geofence.delete({ where: { geofence_id: id } });
export const alertCount = (db: Db, id: bigint) => db.alert.count({ where: { geofence_id: id } });
