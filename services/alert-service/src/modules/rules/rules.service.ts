import { ApiError, parseId, type Caller } from "@vayro/service-kit";
import { thresholdProblem, type RuleType } from "../../domain/alerts";
import { audit } from "../../lib/audit";
import { prisma, type Db } from "../../lib/prisma";
import { publicRule } from "./rules.model";
import * as rules from "./rules.repository";

// company_id always comes from the signed-in user, never from the request.
const companyOf = (me: Caller) => BigInt(me.company_id!);

async function load(db: Db, me: Caller, id: string) {
  const row = await rules.findOne(db, parseId(id), companyOf(me));
  if (!row) throw new ApiError(404, "NOT_FOUND", "Alert rule not found");
  return row;
}

function checkThreshold(type: RuleType, value: number) {
  const message = thresholdProblem(type, value);
  if (message) throw new ApiError(422, "VALIDATION_ERROR", message);
}

export async function listRules(me: Caller) {
  return (await rules.listFor(prisma, companyOf(me))).map(publicRule);
}

export async function createRule(me: Caller, body: { rule_type: RuleType; threshold_value: number; is_enabled?: boolean }, ip: string | null) {
  checkThreshold(body.rule_type, body.threshold_value);
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await rules.create(tx, { company_id: companyOf(me), rule_type: body.rule_type, threshold_value: body.threshold_value, is_enabled: body.is_enabled ?? true, created_by: BigInt(me.user_id) });
      await audit({ companyId: created.company_id, userId: me.user_id, action: "alert_rule.create", entityType: "alert_rule", entityId: created.alert_rule_id, newValue: publicRule(created), ip }, tx);
      return created;
    });
    return publicRule(row);
  } catch (err) {
    // UNIQUE(company_id, rule_type): one rule of each type per company; change the existing one instead.
    if ((err as { code?: string }).code === "P2002") throw new ApiError(409, "RULE_EXISTS", "This company already has a rule of this type; update it instead");
    throw err;
  }
}

export async function updateRule(me: Caller, id: string, body: { threshold_value: number; is_enabled?: boolean }, ip: string | null) {
  const row = await prisma.$transaction(async (tx) => {
    const old = await load(tx, me, id);
    checkThreshold(old.rule_type as RuleType, body.threshold_value);
    const updated = await rules.update(tx, old.alert_rule_id, { threshold_value: body.threshold_value, ...(body.is_enabled !== undefined ? { is_enabled: body.is_enabled } : {}) });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "alert_rule.update", entityType: "alert_rule", entityId: old.alert_rule_id, oldValue: publicRule(old), newValue: publicRule(updated), ip }, tx);
    return updated;
  });
  return publicRule(row);
}

export async function setRuleStatus(me: Caller, id: string, isEnabled: boolean, ip: string | null) {
  const row = await prisma.$transaction(async (tx) => {
    const old = await load(tx, me, id);
    const updated = await rules.update(tx, old.alert_rule_id, { is_enabled: isEnabled });
    await audit({ companyId: old.company_id, userId: me.user_id, action: isEnabled ? "alert_rule.enable" : "alert_rule.disable", entityType: "alert_rule", entityId: old.alert_rule_id, oldValue: publicRule(old), newValue: publicRule(updated), ip }, tx);
    return updated;
  });
  return publicRule(row);
}
