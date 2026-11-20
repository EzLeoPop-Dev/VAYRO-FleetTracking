import { http, idSchema, internalGuard, ok, parseId } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { config } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { windowEnd, type JobStatus } from "../jobs/jobs.rules";

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  // Does this driver have a job in progress on this vehicle? Used to accept driver phone positions.
  .get("/jobs/in-progress", async ({ query }) => {
    const job = await prisma.transportJob.findFirst({
      where: { company_id: parseId(query.company_id), vehicle_id: parseId(query.vehicle_id), driver_id: parseId(query.driver_id), job_status: "in_progress" },
      select: { job_id: true },
    });
    return ok({ exists: job !== null });
  }, { query: t.Object({ company_id: idSchema, vehicle_id: idSchema, driver_id: idSchema }) })
  // When did this driver work this vehicle? route-history-service shows a driver only the stretches of their own jobs.
  // ended_at is null while a job is still running. Newest first, at most 50.
  .get("/jobs/driver-windows", async ({ query }) => {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const rows = await prisma.transportJob.findMany({
      where: {
        company_id: parseId(query.company_id),
        driver_id: parseId(query.driver_id),
        vehicle_id: parseId(query.vehicle_id),
        actual_start_at: { not: null, lte: to },
        // still running, or stopped after the window opened (a stopped job without an end counts until its last update)
        OR: [{ actual_end_at: null, job_status: "in_progress" }, { actual_end_at: { gte: from } }, { actual_end_at: null, job_status: { not: "in_progress" }, updated_at: { gte: from } }],
      },
      select: { job_id: true, job_status: true, actual_start_at: true, actual_end_at: true, updated_at: true },
      orderBy: { actual_start_at: "desc" },
      take: 50,
    });
    return ok(rows.map((row) => ({
      job_id: String(row.job_id),
      started_at: row.actual_start_at!.toISOString(),
      ended_at: windowEnd({ actual_end_at: row.actual_end_at, job_status: row.job_status as JobStatus, updated_at: row.updated_at })?.toISOString() ?? null,
    })));
  }, {
    query: t.Object({ company_id: idSchema, driver_id: idSchema, vehicle_id: idSchema, from: t.Optional(t.String({ format: "date-time" })), to: t.Optional(t.String({ format: "date-time" })) }),
  });
