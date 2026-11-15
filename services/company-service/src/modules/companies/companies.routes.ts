import { http, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import * as service from "./companies.service";

// TODO(team): the rest of the PDF list (GET /companies, GET/PUT /companies/:id, PATCH approve | reject | status)
// goes here, protected with `.use(authed("platform_admin"))` from ../../plugins/guard.
export const companyRoutes = new Elysia({ prefix: "/api/v1/companies" }).use(http).post(
  "/register",
  async ({ body, ip }) => ok(await service.register(body, ip), "Registration received. Sign-in is available once the workspace is approved."),
  {
    body: t.Object({
      company_name: t.String({ minLength: 1, maxLength: 150 }),
      contact_name: t.Optional(t.String({ maxLength: 100 })),
      contact_email: t.String({ minLength: 3, maxLength: 150, format: "email" }),
      contact_phone: t.Optional(t.String({ maxLength: 30 })),
      admin_full_name: t.String({ minLength: 1, maxLength: 150 }),
      admin_email: t.String({ minLength: 3, maxLength: 150, format: "email" }),
      admin_password: t.String({ minLength: 10, maxLength: 128 }),
    }),
  },
);
