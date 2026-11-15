import { writeAudit, type AuditEvent } from "@vayro/service-kit";
import { prisma, type Db } from "./prisma";

// Pass a transaction client to make the change and its audit row atomic. Never pass credentials.
export const audit = (event: AuditEvent, db: Db = prisma) =>
  writeAudit((row) => db.systemLog.create({ data: row as never }), event, db !== prisma);
