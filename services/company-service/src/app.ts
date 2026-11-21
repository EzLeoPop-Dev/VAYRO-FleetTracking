import { createAuthed } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { httpUserResolver, type ResolveUser } from "./adapters/auth-service";
import { companyRoutes } from "./modules/companies/companies.routes";
import { internalRoutes } from "./modules/companies/internal.routes";

// The way to tell who is calling can be replaced (tests pass a fake); by default auth-service is asked over HTTP.
export interface CompanyOptions {
  resolveUser?: ResolveUser;
}

export function createCompanyApp(options: CompanyOptions = {}) {
  const authed = createAuthed(options.resolveUser ?? httpUserResolver());
  return new Elysia()
    .get("/", () => ({ service: "company-service", status: "ok" })) // Docker health check
    .use(companyRoutes({ authed }))
    .use(internalRoutes);
}
