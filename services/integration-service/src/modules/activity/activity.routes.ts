import { http, ok } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { authed } from "../../plugins/guard";
import { integrationLogQuery, systemLogQuery } from "./activity.model";
import * as service from "./activity.service";

// Both logs are for Company Admin (own company) and Platform Admin (platform-wide). They can hold sensitive facts, so nobody else gets them.
export const integrationLogRoutes = new Elysia({ prefix: "/api/v1/integration-logs" }).use(http).use(authed("company_admin", "platform_admin"))
  .get("/", async ({ me, query }) => {
    const { rows, meta } = await service.listRequestLogs(me, query);
    return { ...ok(rows), meta };
  }, { query: integrationLogQuery });

export const systemLogRoutes = new Elysia({ prefix: "/api/v1/system-logs" }).use(http).use(authed("company_admin", "platform_admin"))
  .get("/", async ({ me, query }) => {
    const { rows, meta } = await service.listSystemLogs(me, query);
    return { ...ok(rows), meta };
  }, { query: systemLogQuery });
