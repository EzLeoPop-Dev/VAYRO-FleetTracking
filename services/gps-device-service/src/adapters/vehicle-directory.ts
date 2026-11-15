import { ApiError, internalClient, internalToken, required } from "@vayro/service-kit";

// Vehicles belong to vehicle-service; this service only asks whether one exists in a company.
export interface VehicleInfo {
  vehicle_id: string;
  company_id: string;
  vehicle_status: string;
  current_driver_id: string | null;
}

export interface VehicleDirectory {
  /** null when the vehicle does not exist in that company. */
  getVehicle(companyId: string, vehicleId: string): Promise<VehicleInfo | null>;
}

export function httpVehicleDirectory(): VehicleDirectory {
  const vehicles = internalClient(required("VEHICLE_SERVICE_URL"), internalToken());
  return {
    async getVehicle(companyId, vehicleId) {
      const { status, body } = await vehicles("GET", `/internal/vehicles/${vehicleId}?company_id=${companyId}`);
      if (status === 404) return null;
      if (status !== 200) throw new ApiError(502, "UPSTREAM_ERROR", `vehicle-service returned ${status}`);
      return body.data;
    },
  };
}
