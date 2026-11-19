import { createCompanyAdmin } from "../../adapters/user-service";
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
// The two records live in different services, so they are not one transaction: if the admin cannot be created
// the company is removed again. (A crash between the two steps would leave a pending company with no admin.)
export async function register(body: RegisterInput, ip: string | null) {
  const company = await companies.create(prisma, {
    company_name: body.company_name.trim(),
    contact_name: body.contact_name ?? null,
    contact_email: body.contact_email.trim().toLowerCase(),
    contact_phone: body.contact_phone ?? null,
  });
  try {
    await createCompanyAdmin({
      company_id: String(company.company_id),
      full_name: body.admin_full_name.trim(),
      email: body.admin_email.trim().toLowerCase(),
      password: body.admin_password,
    });
  } catch (err) {
    await companies.remove(prisma, company.company_id).catch((e) => console.error("could not undo company registration:", e instanceof Error ? e.message : "unknown error"));
    throw err;
  }
  await audit({ companyId: company.company_id, action: "company.register", entityType: "company", entityId: company.company_id, ip });
  return { ...company, company_id: String(company.company_id) };
}

export async function getWorkspace(id: bigint) {
  const company = await companies.findById(prisma, id);
  return company && { company_id: String(company.company_id), company_name: company.company_name, workspace_status: company.workspace_status };
}
