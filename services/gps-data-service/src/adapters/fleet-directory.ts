import { ApiError, internalClient, internalToken, required } from "@vayro/service-kit";

// Data gps-data-service needs but does not own. Each answer comes from the owning service over its /internal API.
export interface VehicleInfo {
  vehicle_id: string;
  company_id: string;
  vehicle_status: string;
  current_driver_id: string | null;
}

export interface FleetDirectory {
  /** null when the vehicle does not exist (in that company, or anywhere when companyId is null: Platform Admin). */
  getVehicle(companyId: string | null, vehicleId: string): Promise<VehicleInfo | null>;
  /** null when the company does not exist. */
  workspaceStatus(companyId: string): Promise<string | null>;
  hasActiveJob(companyId: string, vehicleId: string, driverId: string): Promise<boolean>;
}

const unexpected = (service: string, status: number) => new ApiError(502, "UPSTREAM_ERROR", `${service} returned ${status}`);

export function httpFleetDirectory(): FleetDirectory {
  const token = internalToken();
  const vehicles = internalClient(required("VEHICLE_SERVICE_URL"), token);
  const transport = internalClient(required("TRANSPORT_SERVICE_URL"), token);
  const companies = internalClient(required("COMPANY_SERVICE_URL"), token);
  return {
    async getVehicle(companyId, vehicleId) {
      const { status, body } = await vehicles("GET", `/internal/vehicles/${vehicleId}${companyId ? `?company_id=${companyId}` : ""}`);
      if (status === 404) return null;
      if (status !== 200) throw unexpected("vehicle-service", status);
      return body.data;
    },
    async workspaceStatus(companyId) {
      const { status, body } = await companies("GET", `/internal/companies/${companyId}`);
      if (status === 404) return null;
      if (status !== 200) throw unexpected("company-service", status);
      return body.data.workspace_status;
    },
    async hasActiveJob(companyId, vehicleId, driverId) {
      const { status, body } = await transport("GET", `/internal/jobs/in-progress?company_id=${companyId}&vehicle_id=${vehicleId}&driver_id=${driverId}`);
      if (status !== 200) throw unexpected("transport-service", status);
      return body.data.exists === true;
    },
  };
}
