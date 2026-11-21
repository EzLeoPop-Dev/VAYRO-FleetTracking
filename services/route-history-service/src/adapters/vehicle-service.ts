import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const vehicles = internalClient(config.vehicleServiceUrl, config.internalToken);

// null when the vehicle does not exist in that company (a vehicle of another company looks exactly the same).
export async function vehicleInCompany(companyId: string, vehicleId: string): Promise<{ vehicle_id: string } | null> {
  const { status, body } = await vehicles("GET", `/internal/vehicles/${vehicleId}?company_id=${companyId}`);
  if (status === 404) return null;
  if (status !== 200 || !body?.data) throw new ApiError(502, "UPSTREAM_ERROR", `Vehicle service returned ${status}`);
  return body.data;
}
