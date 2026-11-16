import { http, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { authed } from "../../plugins/guard";
import { publicUser } from "./auth.policy";
import * as service from "./auth.service";

const refreshBody = t.Object({ refresh_token: t.String({ minLength: 1, maxLength: 200 }) });

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  .use(http)
  .post("/login", async ({ body, ip, userAgent }) => ok(await service.login(body.email, body.password, ip, userAgent), "Login successful"), {
    body: t.Object({
      email: t.String({ minLength: 3, maxLength: 150 }),
      password: t.String({ minLength: 1, maxLength: 128 }), // cap bounds argon2 work per request
    }),
  })
  .post("/refresh", async ({ body, ip, userAgent }) => ok(await service.refresh(body.refresh_token, ip, userAgent), "Token refreshed"), { body: refreshBody })
  .post("/logout", async ({ body, ip }) => {
    await service.logout(body.refresh_token, ip);
    return ok(null, "Logged out");
  }, { body: refreshBody })
  .use(authed())
  .get("/me", ({ me }) => ok({ ...publicUser(me), workspace_status: me.workspace_status }));
