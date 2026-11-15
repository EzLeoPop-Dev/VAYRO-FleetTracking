import { http, idSchema, internalGuard, ok, parseId } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { config } from "../../config/env";
import { prisma } from "../../lib/prisma";

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  // Does this driver have a job in progress on this vehicle? Used to accept driver phone positions.
  .get("/jobs/in-progress", async ({ query }) => {
    const job = await prisma.transportJob.findFirst({
      where: { company_id: parseId(query.company_id), vehicle_id: parseId(query.vehicle_id), driver_id: parseId(query.driver_id), job_status: "in_progress" },
      select: { job_id: true },
    });
    return ok({ exists: job !== null });
  }, { query: t.Object({ company_id: idSchema, vehicle_id: idSchema, driver_id: idSchema }) });
