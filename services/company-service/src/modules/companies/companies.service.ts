import { ApiError } from "@vayro/service-kit";
import { userAdmins, type AdminDirectory } from "../../adapters/user-service";
import { audit } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import * as companies from "./companies.repository";

export interface RegisterInput {
  company_name: string;
  contact_name?: string;
  contact_email: string;
  contact_phone?: string;
  admin_full_name: string;
  admin_email: string;
  admin_password: string;
}

// Public self-registration. Creates a workspace in 'pending' state plus its first Company Admin.
// The admin cannot sign in until a Platform Admin sets workspace_status to 'active'.
//
// The two records live in different services, so they are not one transaction, and "no answer" does not mean "not done":
// user-service may have created the admin and the reply got lost. So a failed create is never trusted by itself. Before
// anything is undone the admin is looked up:
//   exists   -> it was created after all: carry on, keep the company
//   missing  -> really not created: delete the company again and report the original error (the client may retry)
//   unknown  -> cannot tell: keep the company (deleting it could orphan an admin) and report 503
export async function register(body: RegisterInput, ip: string | null, admins: AdminDirectory = userAdmins) {
  const company = await companies.create(prisma, {
    company_name: body.company_name.trim(),
    contact_name: body.contact_name ?? null,
    contact_email: body.contact_email.trim().toLowerCase(),
    contact_phone: body.contact_phone ?? null,
  });
  const companyId = String(company.company_id);
  const adminEmail = body.admin_email.trim().toLowerCase();
  try {
    await admins.create({ company_id: companyId, full_name: body.admin_full_name.trim(), email: adminEmail, password: body.admin_password });
  } catch (err) {
    const state = await admins.exists(companyId, adminEmail).then((found) => (found ? "exists" : "missing"), () => "unknown");
    if (state === "missing") {
      await companies.remove(prisma, company.company_id).catch((e) => console.error(`could not undo registration of company ${companyId}:`, e instanceof Error ? e.message : "unknown error"));
      throw err;
    }
    if (state === "unknown") {
      console.error(`registration of company ${companyId} could not be confirmed (user-service unreachable); company kept as pending`);
      throw new ApiError(503, "REGISTRATION_UNCONFIRMED", "Registration could not be confirmed. Please contact support before trying again.");
    }
  }
  await audit({ companyId: company.company_id, action: "company.register", entityType: "company", entityId: company.company_id, ip });
  return { ...company, company_id: companyId };
}

export async function getWorkspace(id: bigint) {
  const company = await companies.findById(prisma, id);
  return company && { company_id: String(company.company_id), workspace_status: company.workspace_status };
}
