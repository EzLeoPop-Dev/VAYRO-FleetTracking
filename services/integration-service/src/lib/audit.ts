import { writeAudit, type AuditEvent } from "@vayro/service-kit";
import { prisma, type Db } from "./prisma";

// Writes this service's own system_log. Pass a transaction client to make a change and its audit row atomic.
// Never pass an API key or its hash.
export const audit = (event: AuditEvent, db: Db = prisma) =>
  writeAudit((row) => db.systemLog.create({ data: row as never }), event, db !== prisma);
