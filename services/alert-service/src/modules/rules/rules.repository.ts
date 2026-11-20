import type { Db, Prisma } from "../../lib/prisma";

export const listFor = (db: Db, companyId: bigint) => db.alertRule.findMany({ where: { company_id: companyId }, orderBy: { alert_rule_id: "asc" } });
export const enabledFor = (db: Db, companyId: bigint) => db.alertRule.findMany({ where: { company_id: companyId, is_enabled: true } });
export const findOne = (db: Db, id: bigint, companyId: bigint) => db.alertRule.findFirst({ where: { alert_rule_id: id, company_id: companyId } });
export const create = (db: Db, data: Prisma.AlertRuleUncheckedCreateInput) => db.alertRule.create({ data });
export const update = (db: Db, id: bigint, data: Prisma.AlertRuleUncheckedUpdateInput) => db.alertRule.update({ where: { alert_rule_id: id }, data });
