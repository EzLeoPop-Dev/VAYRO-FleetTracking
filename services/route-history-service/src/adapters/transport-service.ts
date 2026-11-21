import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const transport = internalClient(config.transportServiceUrl, config.internalToken);

export interface JobWindow { job_id: string; started_at: string; ended_at: string | null }

// When this driver worked this vehicle within [from, to] (ended_at null = still running).
export async function driverWindows(companyId: string, driverId: string, vehicleId: string, from: Date, to: Date): Promise<JobWindow[]> {
  const query = new URLSearchParams({ company_id: companyId, driver_id: driverId, vehicle_id: vehicleId, from: from.toISOString(), to: to.toISOString() });
  const { status, body } = await transport("GET", `/internal/jobs/driver-windows?${query}`);
  if (status !== 200 || !Array.isArray(body?.data)) throw new ApiError(502, "UPSTREAM_ERROR", `Transport service returned ${status}`);
  return body.data as JobWindow[];
}
