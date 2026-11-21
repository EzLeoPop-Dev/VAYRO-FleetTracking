import { ApiError, parseId, type Caller } from "@vayro/service-kit";

// Pure rules of the reports: no database, no HTTP.

export const GPS_CURRENT_WITHIN_MS = 5 * 60 * 1000; // same threshold gps-data-service uses for "delayed"
export const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000; // PDF page 25: limit the period so reports stay fast
export const MAX_EXPORT_ROWS = 5000;
export const DEFAULT_DAYS = 30;

export type GpsStatus = "current" | "delayed" | "no_data";

// GPS status from the time the server LAST RECEIVED data, not from a stored connection flag (PDF page 27, 12.5):
// "current" = something arrived within 5 minutes; "delayed" = older; "no_data" = nothing stored for the vehicle.
export function gpsStatus(lastReceivedAt: string | null | undefined, now = new Date()): GpsStatus {
  if (!lastReceivedAt) return "no_data";
  return now.getTime() - new Date(lastReceivedAt).getTime() <= GPS_CURRENT_WITHIN_MS ? "current" : "delayed";
}

// The company a request is about, taken from who is signed in, never from a body field.
// Platform Admins are not tied to a company, so they must name one (the report needs a bounded scope); everyone else
// can only ask about their own company (naming another one is refused).
export function companyFor(me: Caller, requested: string | undefined): string {
  if (me.role === "platform_admin") {
    if (!requested) throw new ApiError(422, "VALIDATION_ERROR", "company_id is required for this endpoint");
    parseId(requested);
    return requested;
  }
  if (!me.company_id) throw new ApiError(403, "FORBIDDEN", "Caller has no company");
  if (requested !== undefined && requested !== me.company_id) throw new ApiError(403, "FORBIDDEN", "Cannot access another company");
  return me.company_id;
}

// A report period: `to` defaults to now, `from` to `defaultDays` before `to`. Never longer than 31 days.
export function parseRange(from?: string, to?: string, defaultDays = 1, now = new Date()): { from: Date; to: Date } {
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  if (start > end) throw new ApiError(422, "VALIDATION_ERROR", "from must not be after to");
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) throw new ApiError(422, "VALIDATION_ERROR", "The period must not be longer than 31 days");
  return { from: start, to: end };
}

export function lastDays(days: number, now = new Date()) {
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: now, days };
}

export function paging(page = 1, limit = 50) {
  return { page, limit, offset: (page - 1) * limit };
}
