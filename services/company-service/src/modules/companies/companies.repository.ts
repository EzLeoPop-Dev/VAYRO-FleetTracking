import type { Db, Prisma } from "../../lib/prisma";

// The only place that talks to the company table.

export const COMPANY_SELECT = { company_id: true, company_name: true, workspace_status: true } as const;

export const create = (db: Db, data: Prisma.CompanyCreateInput) => db.company.create({ data, select: COMPANY_SELECT });

export const remove = (db: Db, id: bigint) => db.company.delete({ where: { company_id: id }, select: { company_id: true } });

export const countByStatus = (db: Db) => db.company.groupBy({ by: ["workspace_status"], _count: { _all: true } });

export const findById = (db: Db, id: bigint) => db.company.findUnique({ where: { company_id: id }, select: COMPANY_SELECT });
