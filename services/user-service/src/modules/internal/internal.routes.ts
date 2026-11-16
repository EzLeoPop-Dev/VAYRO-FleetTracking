import { ApiError, http, idSchema, internalGuard, ok, parseId } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { config } from "../../config/env";
import { audit } from "../../lib/audit";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../../lib/password";
import { prisma } from "../../lib/prisma";
import { emailSchema, nameSchema, publicUser, USER_SELECT } from "../users/users.model";
import * as users from "../users/users.repository";

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  // Used by auth-service at login. The hash never leaves this service: only the verdict and the user do.
  // `user` is set whenever the email exists, even when the password is wrong (needed for auth-service's audit trail).
  .post("/credentials/verify", async ({ body }) => {
    const user = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() }, select: { ...USER_SELECT, password_hash: true } });
    // verify even for unknown emails so response time does not reveal which emails exist
    const valid = await verifyPassword(body.password, user?.password_hash ?? DUMMY_HASH);
    return ok({ valid: valid && user !== null, user: user ? publicUser(user) : null });
  }, { body: t.Object({ email: t.String({ minLength: 3, maxLength: 150 }), password: t.String({ minLength: 1, maxLength: 128 }) }) })
  .get("/users/:id", async ({ params }) => {
    const user = await users.findOne(prisma, { user_id: parseId(params.id) });
    if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
    return ok(publicUser(user));
  }, { params: t.Object({ id: idSchema }) })
  // Does this e-mail belong to a user of this company? company-service asks this when a create call got no answer.
  .get("/users/lookup", async ({ query }) => {
    const user = await users.findOne(prisma, { email: query.email.trim().toLowerCase(), company_id: parseId(query.company_id) });
    if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");
    return ok(publicUser(user));
  }, { query: t.Object({ company_id: idSchema, email: t.String({ minLength: 3, maxLength: 150 }) }) })
  // Used by company-service when a company registers: creates that company's first admin.
  // Safe to call again: the same e-mail already being that company's admin is a success (200), not a second account.
  // The e-mail belonging to anyone or anywhere else is 409.
  .post("/users", async ({ body, ip, set }) => {
    const email = body.email.trim().toLowerCase();
    const companyId = parseId(body.company_id);
    const existing = async () => {
      const user = await users.findOne(prisma, { email });
      if (!user) return null;
      if (user.company_id === companyId && user.role === "company_admin") return user;
      throw new ApiError(409, "CONFLICT", "Resource already exists");
    };
    const already = await existing();
    if (already) return ok(publicUser(already), "User already exists");
    const passwordHash = await hashPassword(body.password);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const user = await users.create(tx, { company_id: companyId, full_name: body.full_name.trim(), email, password_hash: passwordHash, role: body.role });
        await audit({ companyId: user.company_id, action: "user.create_first_admin", entityType: "user", entityId: user.user_id, ip }, tx);
        return user;
      });
      set.status = 201;
      return ok(publicUser(created), "User created");
    } catch (err) {
      // Two identical calls at once: the unique e-mail let one in; the other is the same request, so it succeeds too.
      if ((err as { code?: string }).code === "P2002") {
        const winner = await existing();
        if (winner) return ok(publicUser(winner), "User already exists");
      }
      throw err;
    }
  }, {
    body: t.Object({ company_id: idSchema, full_name: nameSchema, email: emailSchema, password: t.String({ minLength: 10, maxLength: 128 }), role: t.Literal("company_admin") }),
  });
