import { http, ok, type createAuthed } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { idParams, listQuery, rejectBody, statusBody, updateBody } from "./companies.model";
import * as service from "./companies.service";

// PDF page 19. Registering a company is public (a company that has no account yet can only send its request); everything
// else is for the Platform Admin. The two groups are separate instances, so the role check covers only the second one.
export const companyRoutes = ({ authed }: { authed: ReturnType<typeof createAuthed> }) => {
  const open = new Elysia().use(http).post(
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

  const platformAdmin = new Elysia().use(http).use(authed("platform_admin"))
    .get("/", async ({ query }) => {
      const { rows, meta } = await service.list(query);
      return { ...ok(rows), meta };
    }, { query: listQuery })
    .get("/:id", async ({ params }) => ok(await service.get(params.id)), { params: idParams })
    .put("/:id", async ({ me, params, body, ip }) => ok(await service.update(me, params.id, body, ip), "Company updated"), { params: idParams, body: updateBody })
    .patch("/:id/approve", async ({ me, params, ip }) => ok(await service.approve(me, params.id, ip), "Workspace approved"), { params: idParams })
    .patch("/:id/reject", async ({ me, params, body, ip }) => ok(await service.reject(me, params.id, body?.reason, ip), "Request rejected"), { params: idParams, body: rejectBody })
    .patch("/:id/status", async ({ me, params, body, ip }) => ok(await service.setStatus(me, params.id, body.workspace_status, ip), "Workspace status changed"), { params: idParams, body: statusBody });

  return new Elysia({ prefix: "/api/v1/companies" }).use(open).use(platformAdmin);
};
