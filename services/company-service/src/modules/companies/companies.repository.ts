import type { Db, Prisma } from "../../lib/prisma";
import { COMPANY_FULL } from "./companies.model";

// The only place that talks to the company table.

export const COMPANY_SELECT = { company_id: true, company_name: true, workspace_status: true } as const;

export const create = (db: Db, data: Prisma.CompanyCreateInput) => db.company.create({ data, select: COMPANY_SELECT });

export const remove = (db: Db, id: bigint) => db.company.delete({ where: { company_id: id }, select: { company_id: true } });

export const countByStatus = (db: Db) => db.company.groupBy({ by: ["workspace_status"], _count: { _all: true } });

export const findById = (db: Db, id: bigint) => db.company.findUnique({ where: { company_id: id }, select: COMPANY_SELECT });

// ---- read and change a workspace (Platform Admin endpoints) ----

export const list = (db: Db, where: Prisma.CompanyWhereInput, take: number, skip: number) =>
  Promise.all([
    db.company.findMany({ where, select: COMPANY_FULL, orderBy: [{ created_at: "desc" }, { company_id: "desc" }], take, skip }),
    db.company.count({ where }),
  ]);

export const findFull = (db: Db, id: bigint) => db.company.findUnique({ where: { company_id: id }, select: COMPANY_FULL });

// Serializes changes to one workspace, so two admins pressing "approve" at once cannot both win.
export const lock = (db: Db, id: bigint) => db.$queryRaw`SELECT company_id FROM company WHERE company_id = ${id} FOR UPDATE`;

export const update = (db: Db, id: bigint, data: Prisma.CompanyUpdateInput) => db.company.update({ where: { company_id: id }, data, select: COMPANY_FULL });
