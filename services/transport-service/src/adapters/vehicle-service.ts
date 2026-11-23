import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const vehicles = internalClient(config.vehicleServiceUrl, config.internalToken);

export interface VehicleInfo { vehicle_id: string; company_id: string; vehicle_status: string; current_driver_id: string | null }

// Vehicles belong to vehicle-service. A vehicle of another company is "not found", exactly as it is for that service.
export async function getVehicle(companyId: string, vehicleId: string): Promise<VehicleInfo | null> {
  const { status, body } = await vehicles("GET", `/internal/vehicles/${vehicleId}?company_id=${companyId}`);
  if (status === 404) return null;
  if (status !== 200 || !body?.data) throw new ApiError(502, "UPSTREAM_ERROR", `Vehicle service returned ${status}`);
  return body.data as VehicleInfo;
}
