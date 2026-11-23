import { internalToken, required } from "@vayro/service-kit";

export const config = {
  databaseUrl: required("DATABASE_URL"),
  authServiceUrl: required("AUTH_SERVICE_URL"),
  companyServiceUrl: required("COMPANY_SERVICE_URL"),
  internalToken: internalToken(),
};

// Services whose audit rows GET /api/v1/system-logs collects over /internal/system-logs, besides this one's own.
// Only the services that expose that route are listed. Others (auth, company, user, vehicle, gps-device) keep their
// system_log to themselves for now; add one here when its owner adds the route. A URL that is not set is reported as
// "not_configured" instead of failing the request.
export const SYSTEM_LOG_SOURCES: { source: string; url: string | undefined }[] = [
  { source: "transport-service", url: process.env.TRANSPORT_SERVICE_URL },
  { source: "alert-service", url: process.env.ALERT_SERVICE_URL },
];
