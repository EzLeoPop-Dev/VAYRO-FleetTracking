import { integer, internalToken, required } from "@vayro/service-kit";

export const config = {
  databaseUrl: required("DATABASE_URL"),
  authServiceUrl: required("AUTH_SERVICE_URL"),
  internalToken: internalToken(),
  // How often the "GPS offline" check runs. One instance of this service is assumed (the check keeps no cross-instance lock).
  offlineScanSeconds: integer("OFFLINE_SCAN_SECONDS", 60, 5, 3600),
};
