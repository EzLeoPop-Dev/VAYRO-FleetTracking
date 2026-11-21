import { internalToken, required } from "@vayro/service-kit";

export const config = {
  authServiceUrl: required("AUTH_SERVICE_URL"),
  gpsDataServiceUrl: required("GPS_DATA_SERVICE_URL"),
  vehicleServiceUrl: required("VEHICLE_SERVICE_URL"),
  transportServiceUrl: required("TRANSPORT_SERVICE_URL"),
  internalToken: internalToken(),
};
