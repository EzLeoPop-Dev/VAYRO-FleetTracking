import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const users = internalClient(config.userServiceUrl, config.internalToken);

export interface NewAdmin { company_id: string; full_name: string; email: string; password: string }

// Accounts belong to user-service. The password travels only over this internal, token-protected call and is hashed there.
// Behind an interface so tests can replace it with a fake.
export interface AdminDirectory {
  /** Creates the company's first admin. Calling it again for the same admin succeeds without a second account. */
  create(admin: NewAdmin): Promise<void>;
  /** Is there a user with this e-mail in this company? Throws when user-service cannot say. */
  exists(companyId: string, email: string): Promise<boolean>;
}

export const userAdmins: AdminDirectory = {
  async create(admin) {
    const { status } = await users("POST", "/internal/users", { body: { ...admin, role: "company_admin" } });
    if (status === 409) throw new ApiError(409, "CONFLICT", "Resource already exists");
    if (status !== 201 && status !== 200) throw new ApiError(502, "UPSTREAM_ERROR", `User service returned ${status}`);
  },
  async exists(companyId, email) {
    const { status } = await users("GET", `/internal/users/lookup?company_id=${companyId}&email=${encodeURIComponent(email)}`);
    if (status === 200) return true;
    if (status === 404) return false;
    throw new ApiError(502, "UPSTREAM_ERROR", `User service returned ${status}`);
  },
};
