import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const users = internalClient(config.userServiceUrl, config.internalToken);

// Accounts belong to user-service. The password travels only over this internal, token-protected call and is hashed there.
export async function createCompanyAdmin(input: { company_id: string; full_name: string; email: string; password: string }) {
  const { status } = await users("POST", "/internal/users", { body: { ...input, role: "company_admin" } });
  if (status === 409) throw new ApiError(409, "CONFLICT", "Resource already exists");
  if (status !== 201) throw new ApiError(502, "UPSTREAM_ERROR", `User service returned ${status}`);
}
