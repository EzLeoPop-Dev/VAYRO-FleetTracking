import type { Db, Prisma } from "../../lib/prisma";
import { USER_SELECT } from "./users.model";

// The only place that talks to the users table for this module.

export const list = (db: Db, where: Prisma.UserWhereInput, take: number, skip: number) =>
  db.user.findMany({ where, select: USER_SELECT, orderBy: { user_id: "asc" }, take, skip });

export const findOne = (db: Db, where: Prisma.UserWhereInput) => db.user.findFirst({ where, select: USER_SELECT });

// Serializes concurrent changes to one user (read-modify-write with audit).
export const lock = (db: Db, id: bigint) => db.$queryRaw`SELECT user_id FROM users WHERE user_id = ${id} FOR UPDATE`;

export const create = (db: Db, data: Prisma.UserUncheckedCreateInput) => db.user.create({ data, select: USER_SELECT });

export const update = (db: Db, id: bigint, data: Prisma.UserUncheckedUpdateInput) =>
  db.user.update({ where: { user_id: id }, data, select: USER_SELECT });
