import { ApiError, parseId, type Caller } from "@vayro/service-kit";
import { pauseOfflineCheck, raiseAlert } from "../../adapters/alert-service";
import { getUser } from "../../adapters/user-service";
import { getVehicle } from "../../adapters/vehicle-service";
import { audit } from "../../lib/audit";
import { prisma, type Db, type Prisma } from "../../lib/prisma";
import { publicJob, type JobRecord } from "./jobs.model";
import * as jobs from "./jobs.repository";
import { canDo, coordinateProblem, lockKeys, NEXT_STATUS, scheduleProblem, type JobAction, type JobStatus } from "./jobs.rules";

// company_id always comes from the signed-in user (Authentication Service), never from the request.
// Company Admin and Dispatcher see every job of their company; a Driver sees only the jobs assigned to them.
const companyOf = (me: Caller) => BigInt(me.company_id!);
const scopeFor = (me: Caller): Prisma.TransportJobWhereInput => ({ company_id: companyOf(me), ...(me.role === "driver" ? { driver_id: BigInt(me.user_id) } : {}) });

async function loadJob(db: Db, me: Caller, id: string): Promise<JobRecord> {
  const row = await jobs.findOne(db, { job_id: parseId(id), ...scopeFor(me) });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Job not found");
  return row;
}

const VERB: Record<JobAction, string> = { edit: "edited", assign: "assigned", start: "started", complete: "completed", problem: "reported as a problem", cancel: "cancelled" };
function assertAllowed(job: JobRecord, action: JobAction) {
  if (!canDo(job.job_status as JobStatus, action)) throw new ApiError(409, "JOB_STATE_CONFLICT", `A job that is ${job.job_status} cannot be ${VERB[action]}`);
}

const toDate = (value: string | null | undefined) => (value === undefined ? undefined : value === null ? null : new Date(value));
const idOrNull = (id: bigint | null) => (id === null ? null : String(id));

function checkDetail(d: { pickup_latitude: unknown; pickup_longitude: unknown; delivery_latitude: unknown; delivery_longitude: unknown; start: Date | null | undefined; end: Date | null | undefined }) {
  const message = coordinateProblem("pickup", d.pickup_latitude, d.pickup_longitude) ?? coordinateProblem("delivery", d.delivery_latitude, d.delivery_longitude) ?? scheduleProblem(d.start, d.end);
  if (message) throw new ApiError(422, "VALIDATION_ERROR", message);
}

// The vehicle and the driver must exist in the caller's company, and both must be usable.
// Returns warnings, not errors, for things that do not stop the assignment but would stop the driver's phone later.
async function checkAssignable(companyId: bigint, vehicleId: string, driverId: string): Promise<string[]> {
  const company = String(companyId);
  const [vehicle, driver] = await Promise.all([getVehicle(company, vehicleId), getUser(driverId)]);
  if (!vehicle) throw new ApiError(422, "VALIDATION_ERROR", "Vehicle not found in this company");
  if (vehicle.vehicle_status !== "active") throw new ApiError(409, "VEHICLE_NOT_ACTIVE", "Vehicle is not active");
  if (!driver || driver.company_id !== company || driver.role !== "driver") throw new ApiError(422, "VALIDATION_ERROR", "Driver not found in this company");
  if (driver.account_status !== "active") throw new ApiError(409, "DRIVER_NOT_ACTIVE", "Driver account is not active");
  // gps-data-service accepts a driver's phone only for the vehicle whose current_driver_id is that driver.
  return vehicle.current_driver_id === driverId ? [] : ["vehicle_current_driver_differs"];
}

function announceAssignment(job: JobRecord) {
  if (job.driver_id === null) return;
  void raiseAlert({
    company_id: String(job.company_id),
    alert_type: "job_assignment",
    title: `New job assigned: ${job.job_code}`,
    detail: `${job.pickup_address} -> ${job.delivery_address}`,
    vehicle_id: idOrNull(job.vehicle_id),
    job_id: String(job.job_id),
    recipient_user_id: String(job.driver_id),
  });
}

// ---- reads ----

export async function listJobs(me: Caller, q: { status?: JobStatus; vehicle_id?: string; driver_id?: string; search?: string; scheduled_from?: string; scheduled_to?: string; limit?: number; offset?: number }) {
  const where: Prisma.TransportJobWhereInput = {
    ...scopeFor(me),
    ...(q.status ? { job_status: q.status } : {}),
    ...(q.vehicle_id ? { vehicle_id: parseId(q.vehicle_id) } : {}),
    ...(q.driver_id ? { driver_id: parseId(q.driver_id) } : {}),
    ...(q.search ? { OR: [{ job_code: { contains: q.search, mode: "insensitive" } }, { job_name: { contains: q.search, mode: "insensitive" } }] } : {}),
    ...(q.scheduled_from || q.scheduled_to ? { scheduled_start_at: { ...(q.scheduled_from ? { gte: new Date(q.scheduled_from) } : {}), ...(q.scheduled_to ? { lte: new Date(q.scheduled_to) } : {}) } } : {}),
  };
  const limit = q.limit ?? 50, offset = q.offset ?? 0;
  const [rows, total] = await Promise.all([jobs.list(prisma, where, limit, offset), jobs.count(prisma, where)]);
  return { rows: rows.map(publicJob), meta: { total, limit, offset } };
}

export async function getJob(me: Caller, id: string) {
  return publicJob(await loadJob(prisma, me, id));
}

// ---- writes ----

interface JobInput {
  job_name?: string | null;
  pickup_address: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  delivery_address: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
}

export async function createJob(me: Caller, body: JobInput & { job_code: string; vehicle_id?: string | null; driver_id?: string | null }, ip: string | null) {
  const companyId = companyOf(me);
  const start = toDate(body.scheduled_start_at), end = toDate(body.scheduled_end_at);
  checkDetail({ pickup_latitude: body.pickup_latitude, pickup_longitude: body.pickup_longitude, delivery_latitude: body.delivery_latitude, delivery_longitude: body.delivery_longitude, start, end });
  const vehicleId = body.vehicle_id ? parseId(body.vehicle_id) : null;
  const driverId = body.driver_id ? parseId(body.driver_id) : null;
  if ((vehicleId === null) !== (driverId === null)) throw new ApiError(422, "VALIDATION_ERROR", "vehicle_id and driver_id must be given together");
  const warnings = body.vehicle_id && body.driver_id ? await checkAssignable(companyId, body.vehicle_id, body.driver_id) : [];
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await jobs.create(tx, {
        company_id: companyId,
        job_code: body.job_code.trim(),
        job_name: body.job_name?.trim() || null,
        pickup_address: body.pickup_address.trim(),
        pickup_latitude: body.pickup_latitude ?? null,
        pickup_longitude: body.pickup_longitude ?? null,
        delivery_address: body.delivery_address.trim(),
        delivery_latitude: body.delivery_latitude ?? null,
        delivery_longitude: body.delivery_longitude ?? null,
        vehicle_id: vehicleId,
        driver_id: driverId,
        scheduled_start_at: start ?? null,
        scheduled_end_at: end ?? null,
        job_status: vehicleId !== null ? NEXT_STATUS.assign : "pending",
        created_by: BigInt(me.user_id),
      });
      await audit({ companyId, userId: me.user_id, action: "job.create", entityType: "job", entityId: created.job_id, newValue: publicJob(created), ip }, tx);
      return created;
    });
    announceAssignment(row);
    return { ...publicJob(row), warnings };
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ApiError(409, "JOB_CODE_EXISTS", "A job with this job_code already exists in this company");
    throw err;
  }
}

export async function updateJob(me: Caller, id: string, body: Partial<JobInput>, ip: string | null) {
  const row = await prisma.$transaction(async (tx) => {
    await jobs.lock(tx, lockKeys(parseId(id)));
    const old = await loadJob(tx, me, id);
    assertAllowed(old, "edit");
    // Omitted fields stay as they are; null clears an optional field. Check the result, not just what was sent.
    const pick = (sent: unknown, current: unknown) => (sent === undefined ? current : sent);
    const start = body.scheduled_start_at === undefined ? old.scheduled_start_at : toDate(body.scheduled_start_at);
    const end = body.scheduled_end_at === undefined ? old.scheduled_end_at : toDate(body.scheduled_end_at);
    checkDetail({
      pickup_latitude: pick(body.pickup_latitude, old.pickup_latitude), pickup_longitude: pick(body.pickup_longitude, old.pickup_longitude),
      delivery_latitude: pick(body.delivery_latitude, old.delivery_latitude), delivery_longitude: pick(body.delivery_longitude, old.delivery_longitude),
      start, end,
    });
    const updated = await jobs.update(tx, old.job_id, {
      ...(body.job_name !== undefined ? { job_name: body.job_name?.trim() || null } : {}),
      ...(body.pickup_address !== undefined ? { pickup_address: body.pickup_address.trim() } : {}),
      ...(body.pickup_latitude !== undefined ? { pickup_latitude: body.pickup_latitude } : {}),
      ...(body.pickup_longitude !== undefined ? { pickup_longitude: body.pickup_longitude } : {}),
      ...(body.delivery_address !== undefined ? { delivery_address: body.delivery_address.trim() } : {}),
      ...(body.delivery_latitude !== undefined ? { delivery_latitude: body.delivery_latitude } : {}),
      ...(body.delivery_longitude !== undefined ? { delivery_longitude: body.delivery_longitude } : {}),
      ...(body.scheduled_start_at !== undefined ? { scheduled_start_at: start } : {}),
      ...(body.scheduled_end_at !== undefined ? { scheduled_end_at: end } : {}),
    });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "job.update", entityType: "job", entityId: old.job_id, oldValue: publicJob(old), newValue: publicJob(updated), ip }, tx);
    return updated;
  });
  return publicJob(row);
}

export async function assignJob(me: Caller, id: string, body: { vehicle_id: string; driver_id: string }, ip: string | null) {
  await loadJob(prisma, me, id); // 404 before asking other services anything
  const vehicleId = parseId(body.vehicle_id), driverId = parseId(body.driver_id);
  const warnings = await checkAssignable(companyOf(me), body.vehicle_id, body.driver_id);
  const row = await prisma.$transaction(async (tx) => {
    await jobs.lock(tx, lockKeys(parseId(id)));
    const old = await loadJob(tx, me, id);
    assertAllowed(old, "assign");
    const updated = await jobs.update(tx, old.job_id, { vehicle_id: vehicleId, driver_id: driverId, job_status: NEXT_STATUS.assign });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "job.assign", entityType: "job", entityId: old.job_id, oldValue: publicJob(old), newValue: publicJob(updated), ip }, tx);
    return updated;
  });
  announceAssignment(row);
  return { ...publicJob(row), warnings };
}

export async function startJob(me: Caller, id: string, ip: string | null) {
  const probe = await loadJob(prisma, me, id);
  assertAllowed(probe, "start");
  if (probe.vehicle_id === null || probe.driver_id === null) throw new ApiError(409, "JOB_NOT_ASSIGNED", "The job needs a vehicle and a driver before it can start");
  const vehicle = await getVehicle(String(probe.company_id), String(probe.vehicle_id));
  if (!vehicle) throw new ApiError(409, "VEHICLE_NOT_FOUND", "The assigned vehicle no longer exists in this company");
  if (vehicle.vehicle_status !== "active") throw new ApiError(409, "VEHICLE_NOT_ACTIVE", "Vehicle is not active");

  const row = await prisma.$transaction(async (tx) => {
    // Lock the job, its driver and its vehicle together: two jobs can never start at once for the same driver or vehicle.
    await jobs.lock(tx, lockKeys(probe.job_id, probe.driver_id, probe.vehicle_id));
    const old = await loadJob(tx, me, id);
    if (old.driver_id !== probe.driver_id || old.vehicle_id !== probe.vehicle_id) throw new ApiError(409, "JOB_STATE_CONFLICT", "The job was changed by someone else; try again");
    assertAllowed(old, "start");
    const running = { company_id: old.company_id, job_status: "in_progress" as const, NOT: { job_id: old.job_id } };
    if (await jobs.findOne(tx, { ...running, driver_id: old.driver_id })) throw new ApiError(409, "DRIVER_BUSY", "The driver already has a job in progress");
    if (await jobs.findOne(tx, { ...running, vehicle_id: old.vehicle_id })) throw new ApiError(409, "VEHICLE_BUSY", "The vehicle already has a job in progress");
    const updated = await jobs.update(tx, old.job_id, { job_status: NEXT_STATUS.start, actual_start_at: old.actual_start_at ?? new Date(), actual_end_at: null });
    await audit({ companyId: old.company_id, userId: me.user_id, action: "job.start", entityType: "job", entityId: old.job_id, oldValue: publicJob(old), newValue: publicJob(updated), ip }, tx);
    return updated;
  });
  const warnings = vehicle.current_driver_id === String(probe.driver_id) ? [] : ["vehicle_current_driver_differs"];
  return { ...publicJob(row), warnings };
}

// complete, problem and cancel share the same shape: check the state under a lock, change it, audit it.
async function finishJob(me: Caller, id: string, action: "complete" | "problem" | "cancel", ip: string | null, extra: { problem_note?: string; reason?: string } = {}) {
  const { updated, wasRunning } = await prisma.$transaction(async (tx) => {
    await jobs.lock(tx, lockKeys(parseId(id)));
    const old = await loadJob(tx, me, id);
    assertAllowed(old, action);
    const wasRunning = old.job_status === "in_progress";
    const data: Prisma.TransportJobUncheckedUpdateInput = { job_status: NEXT_STATUS[action] };
    if (action === "complete" || (action === "cancel" && wasRunning)) data.actual_end_at = new Date();
    if (action === "problem") data.problem_note = extra.problem_note;
    const updated = await jobs.update(tx, old.job_id, data);
    await audit({
      companyId: old.company_id, userId: me.user_id, action: `job.${action}`, entityType: "job", entityId: old.job_id,
      oldValue: publicJob(old), newValue: { ...publicJob(updated), ...(extra.reason ? { reason: extra.reason } : {}) }, ip,
    }, tx);
    return { updated, wasRunning };
  });
  // After the commit: the job's phone is expected to go quiet now, and a problem is worth telling the dispatchers about.
  if (wasRunning && updated.vehicle_id !== null) void pauseOfflineCheck(String(updated.company_id), String(updated.vehicle_id));
  if (action === "problem") {
    void raiseAlert({
      company_id: String(updated.company_id),
      alert_type: "system_anomaly",
      title: `Job problem: ${updated.job_code}`,
      detail: extra.problem_note,
      vehicle_id: idOrNull(updated.vehicle_id),
      job_id: String(updated.job_id),
      event_data: { reason: "job_problem", reported_by: me.user_id },
    });
  }
  return publicJob(updated);
}

export const completeJob = (me: Caller, id: string, ip: string | null) => finishJob(me, id, "complete", ip);
export const reportProblem = (me: Caller, id: string, problemNote: string, ip: string | null) => finishJob(me, id, "problem", ip, { problem_note: problemNote.trim() });
export const cancelJob = (me: Caller, id: string, reason: string | undefined, ip: string | null) => finishJob(me, id, "cancel", ip, { reason: reason?.trim() });
