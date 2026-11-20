import type { Db, Prisma } from "../../lib/prisma";

export const list = (db: Db, where: Prisma.AlertWhereInput, take: number, skip: number) =>
  db.alert.findMany({ where, orderBy: [{ triggered_at: "desc" }, { alert_id: "desc" }], take, skip });
export const count = (db: Db, where: Prisma.AlertWhereInput) => db.alert.count({ where });
export const findOne = (db: Db, where: Prisma.AlertWhereInput) => db.alert.findFirst({ where });
export const create = (db: Db, data: Prisma.AlertUncheckedCreateInput) => db.alert.create({ data });
export const update = (db: Db, id: bigint, data: Prisma.AlertUncheckedUpdateInput) => db.alert.update({ where: { alert_id: id }, data });

// Is the same alert (vehicle, type, title) still open and recent? Used so one problem does not raise an alert for every GPS point.
export const hasRecentOpen = (db: Db, key: { company_id: bigint; vehicle_id: bigint; alert_type: Prisma.AlertUncheckedCreateInput["alert_type"]; title: string }, since: Date) =>
  db.alert.findFirst({ where: { ...key, alert_status: { not: "resolved" }, triggered_at: { gte: since } }, select: { alert_id: true } }).then((row) => row !== null);
