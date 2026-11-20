import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const companies = internalClient(config.companyServiceUrl, config.internalToken);

// null when the company does not exist.
export async function workspaceStatus(companyId: string): Promise<string | null> {
  const { status, body } = await companies("GET", `/internal/companies/${companyId}`);
  if (status === 404) return null;
  if (status !== 200 || !body?.data) throw new ApiError(502, "UPSTREAM_ERROR", `Company service returned ${status}`);
  return body.data.workspace_status as string;
}
