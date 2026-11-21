import { http, ok } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { authed } from "../../plugins/guard";
import { createBody, idParams, listQuery, updateBody } from "./integrations.model";
import * as service from "./integrations.service";

// Company Admin manages the keys; Platform Admin can look (read only).
const readRoutes = new Elysia().use(http).use(authed("company_admin", "platform_admin"))
  .get("/", async ({ me, query }) => {
    const { rows, meta } = await service.listIntegrations(me, query);
    return { ...ok(rows), meta };
  }, { query: listQuery })
  .get("/:id", async ({ me, params }) => ok(await service.getIntegration(me, params.id)), { params: idParams });

const writeRoutes = new Elysia().use(http).use(authed("company_admin"))
  .post("/", async ({ me, body, ip, set }) => {
    const created = await service.createIntegration(me, body, ip);
    set.status = 201;
    return ok(created, "Integration created");
  }, { body: createBody })
  .put("/:id", async ({ me, params, body, ip }) => ok(await service.updateIntegration(me, params.id, body, ip), "Integration updated"), { params: idParams, body: updateBody })
  .post("/:id/rotate-key", async ({ me, params, ip }) => ok(await service.rotateKey(me, params.id, ip), "API key rotated"), { params: idParams })
  .patch("/:id/revoke", async ({ me, params, ip }) => ok(await service.revokeIntegration(me, params.id, ip), "Integration revoked"), { params: idParams });

export const integrationRoutes = new Elysia({ prefix: "/api/v1/integrations" }).use(readRoutes).use(writeRoutes);
