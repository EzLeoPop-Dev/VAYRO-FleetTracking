import { http, ok } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { authed } from "../../plugins/guard";
import { createBody, idParams, listQuery, statusBody, updateBody } from "./geofences.model";
import * as service from "./geofences.service";

// Company Admin draws and edits the areas; Dispatcher can read them.
const readRoutes = new Elysia().use(http).use(authed("company_admin", "dispatcher"))
  .get("/", async ({ me, query }) => {
    const { rows, meta } = await service.listGeofences(me, query);
    return { ...ok(rows), meta };
  }, { query: listQuery });

const writeRoutes = new Elysia().use(http).use(authed("company_admin"))
  .post("/", async ({ me, body, ip, set }) => {
    const geofence = await service.createGeofence(me, body, ip);
    set.status = 201;
    return ok(geofence, "Geofence created");
  }, { body: createBody })
  .put("/:id", async ({ me, params, body, ip }) => ok(await service.updateGeofence(me, params.id, body, ip), "Geofence updated"), { params: idParams, body: updateBody })
  .patch("/:id/status", async ({ me, params, body, ip }) => ok(await service.setGeofenceStatus(me, params.id, body.geofence_status, ip), "Geofence status changed"), { params: idParams, body: statusBody })
  .delete("/:id", async ({ me, params, ip }) => {
    await service.deleteGeofence(me, params.id, ip);
    return ok({ geofence_id: params.id, deleted: true }, "Geofence deleted"); // 200 with the usual envelope, so request_id is returned
  }, { params: idParams });

export const geofenceRoutes = new Elysia({ prefix: "/api/v1/geofences" }).use(readRoutes).use(writeRoutes);
