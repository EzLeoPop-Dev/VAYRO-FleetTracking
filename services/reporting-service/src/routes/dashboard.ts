import { http, idSchema, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { companyDashboard, platformDashboard } from "../application/dashboards";
import { resolveCompany } from "../application/scope";
import { DEFAULT_DAYS } from "../domain/rules";
import type { ReportDeps } from "./reports";

const days = t.Optional(t.Numeric({ minimum: 1, maximum: 31, multipleOf: 1 }));

// PDF page 25: the platform overview is for the Platform Admin only; the company overview for the Company Admin
// (all sections) and the Dispatcher (jobs and vehicle status, without user counts). A Platform Admin names the company.
// Two separate instances, so each one's role check applies only to its own route.
export const dashboardRoutes = ({ authed, sources, clock }: ReportDeps) => {
  const platform = new Elysia().use(http).use(authed("platform_admin"))
    .get("/platform", async ({ query }) => ok(await platformDashboard(sources, query.days ?? DEFAULT_DAYS, clock())), { query: t.Object({ days }) });
  const company = new Elysia().use(http).use(authed("platform_admin", "company_admin", "dispatcher"))
    .get("/company", async ({ me, query }) => ok(await companyDashboard(sources, me.role, await resolveCompany(sources, me, query.company_id), query.days ?? DEFAULT_DAYS, clock())), {
      query: t.Object({ company_id: t.Optional(idSchema), days }),
    });
  return new Elysia({ prefix: "/api/v1/dashboard" }).use(platform).use(company);
};
