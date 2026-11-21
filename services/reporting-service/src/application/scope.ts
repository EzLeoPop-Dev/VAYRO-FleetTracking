import { ApiError, type Caller } from "@vayro/service-kit";
import type { Sources } from "../adapters/sources";
import { companyFor } from "../domain/rules";

// The company a request is about. A company user's company is their own, which exists by definition. A Platform Admin
// names one, so it is checked: an id that does not exist is 404, never a dashboard full of zeros that looks real.
export async function resolveCompany(sources: Sources, me: Caller, requested: string | undefined): Promise<string> {
  const companyId = companyFor(me, requested);
  if (me.role === "platform_admin" && !(await sources.companyExists(companyId))) throw new ApiError(404, "NOT_FOUND", "Company not found");
  return companyId;
}
