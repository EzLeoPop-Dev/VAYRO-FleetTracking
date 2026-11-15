import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const companies = internalClient(config.companyServiceUrl, config.internalToken);

// Companies belong to company-service; this service only asks whether one exists.
export async function companyExists(companyId: string): Promise<boolean> {
  const { status } = await companies("GET", `/internal/companies/${companyId}`);
  if (status === 404) return false;
  if (status !== 200) throw new ApiError(502, "UPSTREAM_ERROR", `Company service returned ${status}`);
  return true;
}
