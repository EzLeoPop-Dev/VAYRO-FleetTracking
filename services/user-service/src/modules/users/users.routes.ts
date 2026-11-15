import { http, idSchema, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { authed } from "../../plugins/guard";
import { companySchema, emailSchema, nameSchema, phoneSchema, profileSchema, roleSchema, statusSchema } from "./users.model";
import * as service from "./users.service";

const meRoutes = new Elysia().use(http).use(authed())
  .get("/me", async ({ me }) => ok(await service.getProfile(me)))
  .put("/me", async ({ me, body, ip }) => ok(await service.updateSelf(me, body, ip), "Profile updated"), { body: profileSchema });

const adminRoutes = new Elysia().use(http).use(authed("company_admin", "platform_admin"))
  .get("/", async ({ me, query }) => ok(await service.listUsers(me, query)), {
    query: t.Object({
      company_id: t.Optional(idSchema),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
      offset: t.Optional(t.Numeric({ minimum: 0, maximum: 2147483647, multipleOf: 1 })),
    }),
  })
  .get("/:id", async ({ me, params }) => ok(await service.getUser(me, params.id)), { params: t.Object({ id: idSchema }) })
  .post("/", async ({ me, body, ip, set }) => {
    const user = await service.createUser(me, body, ip);
    set.status = 201;
    return ok(user, "User created");
  }, {
    body: t.Object({ full_name: nameSchema, email: emailSchema, password: t.String({ minLength: 10, maxLength: 128 }), role: roleSchema, company_id: companySchema, phone: phoneSchema }),
  })
  .put("/:id", async ({ me, params, body, ip }) => ok(await service.updateUser(me, params.id, body, ip), "User updated"), { params: t.Object({ id: idSchema }), body: profileSchema })
  .patch("/:id/role", async ({ me, params, body, ip }) => ok(await service.changeRole(me, params.id, body, ip), "Role updated"), {
    params: t.Object({ id: idSchema }),
    body: t.Object({ role: roleSchema, company_id: companySchema }),
  })
  .patch("/:id/status", async ({ me, params, body, ip }) => ok(await service.changeStatus(me, params.id, body.account_status, ip), "Status updated"), {
    params: t.Object({ id: idSchema }),
    body: t.Object({ account_status: statusSchema }),
  });

export const userRoutes = new Elysia({ prefix: "/api/v1/users" }).use(meRoutes).use(adminRoutes);
