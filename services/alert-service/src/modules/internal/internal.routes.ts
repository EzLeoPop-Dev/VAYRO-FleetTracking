import { http, idSchema, internalGuard, ok } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { processLocation } from "../../application/process-location";
import { config } from "../../config/env";
import * as signal from "../../infrastructure/signal.repository";
import { prisma } from "../../lib/prisma";
import { internalAlertBody } from "../alerts/alerts.model";
import { createInternalAlert } from "../alerts/alerts.service";

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  // gps-data-service pushes every stored point here (set GPS_EVENT_SUBSCRIBERS=http://alert-service:3000 there).
  .post("/gps/locations", async ({ body }) => {
    await processLocation(body.location);
    return ok({ processed: true });
  }, {
    body: t.Object({
      event: t.Literal("gps_location.stored"),
      location: t.Object({
        company_id: idSchema,
        vehicle_id: idSchema,
        latitude: t.Number({ minimum: -90, maximum: 90 }),
        longitude: t.Number({ minimum: -180, maximum: 180 }),
        speed_kmh: t.Union([t.Number(), t.Null()]),
        recorded_at: t.String({ format: "date-time" }),
        received_at: t.String({ format: "date-time" }),
        freshness: t.Union([t.Literal("current"), t.Literal("delayed")]),
        anomalies: t.Array(t.String()),
        gps_location_id: t.Optional(idSchema),
      }),
    }),
  })
  // transport-service: a job was assigned, or a driver reported a problem.
  .post("/alerts", async ({ body, set }) => {
    const alert = await createInternalAlert(body);
    set.status = 201;
    return ok(alert, "Alert created");
  }, { body: internalAlertBody })
  // transport-service: the vehicle's job ended, so silence from its phone is expected until it reports again.
  .post("/signal/pause", async ({ body }) => {
    await signal.pause(prisma, BigInt(body.company_id), BigInt(body.vehicle_id));
    return ok({ paused: true });
  }, { body: t.Object({ company_id: idSchema, vehicle_id: idSchema }, { additionalProperties: false }) });
