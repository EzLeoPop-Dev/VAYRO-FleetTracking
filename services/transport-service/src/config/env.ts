import { internalToken, required } from "@vayro/service-kit";

export const config = {
  databaseUrl: required("DATABASE_URL"),
  authServiceUrl: required("AUTH_SERVICE_URL"),
  vehicleServiceUrl: required("VEHICLE_SERVICE_URL"),
  userServiceUrl: required("USER_SERVICE_URL"),
  // Optional: without it jobs still work, they just do not raise alerts or pause the offline check.
  alertServiceUrl: process.env.ALERT_SERVICE_URL || null,
  internalToken: internalToken(),
};
