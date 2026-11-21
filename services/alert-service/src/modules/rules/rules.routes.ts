import { http, ok } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { authed } from "../../plugins/guard";
import { createBody, idParams, statusBody, updateBody } from "./rules.model";
import * as service from "./rules.service";

// Company Admin sets the thresholds; Dispatcher can read them.
const readRoutes = new Elysia().use(http).use(authed("company_admin", "dispatcher"))
  .get("/", async ({ me }) => ok(await service.listRules(me)));

const writeRoutes = new Elysia().use(http).use(authed("company_admin"))
  .post("/", async ({ me, body, ip, set }) => {
    const rule = await service.createRule(me, body, ip);
    set.status = 201;
    return ok(rule, "Alert rule created");
  }, { body: createBody })
  .put("/:id", async ({ me, params, body, ip }) => ok(await service.updateRule(me, params.id, body, ip), "Alert rule updated"), { params: idParams, body: updateBody })
  .patch("/:id/status", async ({ me, params, body, ip }) => ok(await service.setRuleStatus(me, params.id, body.is_enabled, ip), "Alert rule status changed"), { params: idParams, body: statusBody });

export const ruleRoutes = new Elysia({ prefix: "/api/v1/alert-rules" }).use(readRoutes).use(writeRoutes);
