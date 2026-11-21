import { http, ok } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { authed } from "../../plugins/guard";
import { idParams, listQuery } from "./alerts.model";
import * as service from "./alerts.service";

// Everyone who receives alerts can list, open and mark their own as read.
const readRoutes = new Elysia().use(http).use(authed("company_admin", "dispatcher", "driver"))
  .get("/", async ({ me, query }) => {
    const { rows, meta } = await service.listAlerts(me, query);
    return { ...ok(rows), meta };
  }, { query: listQuery })
  .get("/:id", async ({ me, params }) => ok(await service.getAlert(me, params.id)), { params: idParams })
  .patch("/:id/read", async ({ me, params, ip }) => ok(await service.changeAlert(me, params.id, "read", ip), "Alert marked as read"), { params: idParams });

// Taking over and closing an alert is the Company Admin's and Dispatcher's job.
const handleRoutes = new Elysia().use(http).use(authed("company_admin", "dispatcher"))
  .patch("/:id/handling", async ({ me, params, ip }) => ok(await service.changeAlert(me, params.id, "handling", ip), "Alert is being handled"), { params: idParams })
  .patch("/:id/resolve", async ({ me, params, ip }) => ok(await service.changeAlert(me, params.id, "resolve", ip), "Alert resolved"), { params: idParams });

export const alertRoutes = new Elysia({ prefix: "/api/v1/alerts" }).use(readRoutes).use(handleRoutes);
