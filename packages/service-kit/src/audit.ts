export interface AuditEvent {
  companyId?: string | bigint | null;
  userId?: string | bigint | null;
  action: string;
  entityType?: string;
  entityId?: string | bigint;
  oldValue?: object;
  newValue?: object;
  result?: "success" | "failure";
  ip?: string | null;
}

const big = (v?: string | bigint | null) => (v === undefined || v === null ? null : BigInt(v));

// Each service writes its own system_log table; this only shapes the row and handles failure policy.
// strict=true (inside a transaction): an audit failure must roll the change back.
// strict=false: best effort, an audit failure never breaks the request. Never pass secrets.
export async function writeAudit(write: (row: Record<string, unknown>) => Promise<unknown>, e: AuditEvent, strict: boolean) {
  try {
    await write({
      company_id: big(e.companyId),
      user_id: big(e.userId),
      action: e.action,
      entity_type: e.entityType ?? null,
      entity_id: e.entityId === undefined ? null : String(e.entityId),
      old_value: e.oldValue,
      new_value: e.newValue,
      result: e.result ?? "success",
      ip_address: e.ip ?? null,
    });
  } catch (err) {
    if (strict) throw err;
    console.error("audit write failed:", err instanceof Error ? err.message : "unknown error");
  }
}
