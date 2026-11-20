import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const users = internalClient(config.userServiceUrl, config.internalToken);

export interface UserInfo { user_id: string; company_id: string | null; role: string; account_status: string; full_name: string }

// Users belong to user-service. It does not filter by company here, so the caller must compare company_id itself.
export async function getUser(userId: string): Promise<UserInfo | null> {
  const { status, body } = await users("GET", `/internal/users/${userId}`);
  if (status === 404) return null;
  if (status !== 200 || !body?.data) throw new ApiError(502, "UPSTREAM_ERROR", `User service returned ${status}`);
  return body.data as UserInfo;
}
