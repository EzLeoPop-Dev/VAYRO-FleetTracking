import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";

const ruleType = t.Union([t.Literal("gps_offline"), t.Literal("overspeed")]);

// threshold_value: minutes for gps_offline, km/h for overspeed (range checked per type in the service).
export const createBody = t.Object({ rule_type: ruleType, threshold_value: t.Number(), is_enabled: t.Optional(t.Boolean()) }, { additionalProperties: false });
export const updateBody = t.Object({ threshold_value: t.Number(), is_enabled: t.Optional(t.Boolean()) }, { additionalProperties: false });
export const statusBody = t.Object({ is_enabled: t.Boolean() }, { additionalProperties: false });
export const idParams = t.Object({ id: idSchema });

interface Num { toNumber(): number }
export interface RuleRecord {
  alert_rule_id: bigint;
  company_id: bigint;
  rule_type: string;
  threshold_value: Num | null;
  is_enabled: boolean;
  created_by: bigint;
  created_at: Date;
  updated_at: Date;
}

export const publicRule = (r: RuleRecord) => ({
  alert_rule_id: String(r.alert_rule_id),
  company_id: String(r.company_id),
  rule_type: r.rule_type,
  threshold_value: r.threshold_value === null ? null : r.threshold_value.toNumber(),
  is_enabled: r.is_enabled,
  created_by: String(r.created_by),
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});
