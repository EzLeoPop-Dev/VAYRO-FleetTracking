
import { http, ok } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { authed } from "../../plugins/guard";
import {
  assignBody,
  cancelBody,
  createBody,
  driverListQuery,
  idParams,
  listQuery,
  problemBody,
  updateBody,
} from "./jobs.model";
import * as service from "./jobs.service";

// Fields allowed when creating a job.
// company_id and created_by must come from the authenticated user.
const createAllowedFields = [
  "job_code",
  "job_name",
  "pickup_address",
  "pickup_latitude",
  "pickup_longitude",
  "delivery_address",
  "delivery_latitude",
  "delivery_longitude",
  "scheduled_start_at",
  "scheduled_end_at",
  "vehicle_id",
  "driver_id",
];

const hasUnknownFields = (body: unknown): boolean => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false;
  }

  return Object.keys(body).some(
    (key) => !createAllowedFields.includes(key),
  );
};

// Dispatchers and Company Admins manage jobs.
const staffRoutes = new Elysia()
  .use(http)
  .use(authed("company_admin", "dispatcher"))

  .get("/", async ({ me, query }) => {
    const { rows, meta } = await service.listJobs(me, query);
    return { ...ok(rows), meta };
  }, { query: listQuery })

  .post("/", async ({ me, body, ip, set }) => {
    if (hasUnknownFields(body)) {
      set.status = 422;

      return {
        success: false,
        message: "Request contains unknown fields",
      };
    }

    const job = await service.createJob(me, body, ip);

    set.status = 201;
    return ok(job, "Job created");
  }, { body: createBody })

  .put("/:id", async ({ me, params, body, ip }) =>
    ok(await service.updateJob(me, params.id, body, ip), "Job updated"),
    { params: idParams, body: updateBody })

  .patch("/:id/assign", async ({ me, params, body, ip }) =>
    ok(await service.assignJob(me, params.id, body, ip), "Vehicle and driver assigned"),
    { params: idParams, body: assignBody })

  .patch("/:id/cancel", async ({ me, params, body, ip }) =>
    ok(await service.cancelJob(me, params.id, body?.reason, ip), "Job cancelled"),
    { params: idParams, body: cancelBody });

// Shared routes for staff and drivers.
const sharedRoutes = new Elysia()
  .use(http)
  .use(authed("company_admin", "dispatcher", "driver"))

  .get("/:id", async ({ me, params }) =>
    ok(await service.getJob(me, params.id)),
    { params: idParams })

  .patch("/:id/start", async ({ me, params, ip }) =>
    ok(await service.startJob(me, params.id, ip), "Job started"),
    { params: idParams })

  .patch("/:id/complete", async ({ me, params, ip }) =>
    ok(await service.completeJob(me, params.id, ip), "Job completed"),
    { params: idParams })

  .patch("/:id/problem", async ({ me, params, body, ip }) =>
    ok(await service.reportProblem(me, params.id, body.problem_note, ip), "Problem reported"),
    { params: idParams, body: problemBody });

export const jobRoutes = new Elysia({
  prefix: "/api/v1/jobs",
})
  .use(staffRoutes)
  .use(sharedRoutes);

// GET /api/v1/driver/jobs
// Drivers can only access their own jobs.
export const driverRoutes = new Elysia({
  prefix: "/api/v1/driver",
})
  .use(http)
  .use(authed("driver"))

  .get("/jobs", async ({ me, query }) => {
    const { rows, meta } = await service.listJobs(me, query);
    return { ...ok(rows), meta };
  }, { query: driverListQuery });
