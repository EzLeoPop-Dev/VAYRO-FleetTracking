
import { idSchema } from "@vayro/service-kit";
import { t } from "elysia";

// ---- request schemas ----

// Reject unknown fields.
// company_id and created_by must come from the authenticated user.

const text = (max: number) =>
  t.String({
    minLength: 1,
    maxLength: max,
    pattern: "\\S",
  });

const nullable = <T extends Parameters<typeof t.Optional>[0]>(
  schema: T,
) => t.Optional(t.Union([schema, t.Null()]));

const latitude = t.Number({
  minimum: -90,
  maximum: 90,
});

const longitude = t.Number({
  minimum: -180,
  maximum: 180,
});

const dateTime = t.String({
  format: "date-time",
});

export const statusSchema = t.Union([
  t.Literal("pending"),
  t.Literal("assigned"),
  t.Literal("in_progress"),
  t.Literal("completed"),
  t.Literal("cancelled"),
  t.Literal("problem"),
]);

const detailFields = {
  job_name: nullable(text(150)),
  pickup_address: text(255),
  pickup_latitude: nullable(latitude),
  pickup_longitude: nullable(longitude),
  delivery_address: text(255),
  delivery_latitude: nullable(latitude),
  delivery_longitude: nullable(longitude),
  scheduled_start_at: nullable(dateTime),
  scheduled_end_at: nullable(dateTime),
};

// CREATE JOB

export const createBody = t.Object(
  {
    job_code: text(50),
    ...detailFields,
    vehicle_id: t.Optional(
      t.Union([idSchema, t.Null()]),
    ),
    driver_id: t.Optional(
      t.Union([idSchema, t.Null()]),
    ),

    // Fields that must be rejected by the route handler
    company_id: t.Optional(t.Unknown()),
    created_by: t.Optional(t.Unknown()),
  },
  {
    additionalProperties: false,
  },
);


// UPDATE JOB
// job_code, vehicle and driver are not edited here.
// Use the assign endpoint for vehicle and driver changes.
export const updateBody = t.Object(
  detailFields,
  {
    additionalProperties: false,
  },
);

// ASSIGN VEHICLE AND DRIVER
export const assignBody = t.Object(
  {
    vehicle_id: idSchema,
    driver_id: idSchema,
  },
  {
    additionalProperties: false,
  },
);

// REPORT PROBLEM
export const problemBody = t.Object(
  {
    problem_note: text(2000),
  },
  {
    additionalProperties: false,
  },
);

// CANCEL JOB
export const cancelBody = t.Optional(
  t.Object(
    {
      reason: t.Optional(text(500)),
    },
    {
      additionalProperties: false,
    },
  ),
);

// ---- query schemas ----

const paging = {
  limit: t.Optional(
    t.Numeric({
      minimum: 1,
      maximum: 100,
      multipleOf: 1,
    }),
  ),

  offset: t.Optional(
    t.Numeric({
      minimum: 0,
      maximum: 2147483647,
      multipleOf: 1,
    }),
  ),
};

export const listQuery = t.Object({
  status: t.Optional(statusSchema),
  vehicle_id: t.Optional(idSchema),
  driver_id: t.Optional(idSchema),
  search: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 100,
    }),
  ),
  scheduled_from: t.Optional(dateTime),
  scheduled_to: t.Optional(dateTime),
  ...paging,
});

export const driverListQuery = t.Object({
  status: t.Optional(statusSchema),
  ...paging,
});

export const idParams = t.Object({
  id: idSchema,
});

// ---- response mapping ----

interface Num {
  toNumber(): number;
}

export interface JobRecord {
  job_id: bigint;
  company_id: bigint;
  job_code: string;
  job_name: string | null;
  pickup_address: string;
  pickup_latitude: Num | null;
  pickup_longitude: Num | null;
  delivery_address: string;
  delivery_latitude: Num | null;
  delivery_longitude: Num | null;
  vehicle_id: bigint | null;
  driver_id: bigint | null;
  scheduled_start_at: Date | null;
  scheduled_end_at: Date | null;
  actual_start_at: Date | null;
  actual_end_at: Date | null;
  job_status: string;
  problem_note: string | null;
  created_by: bigint;
  created_at: Date;
  updated_at: Date;
}

const idOrNull = (id: bigint | null) =>
  id === null ? null : String(id);

const numOrNull = (n: Num | null) =>
  n === null ? null : n.toNumber();

const isoOrNull = (d: Date | null) =>
  d === null ? null : d.toISOString();

export function publicJob(j: JobRecord) {
  return {
    job_id: String(j.job_id),
    company_id: String(j.company_id),
    job_code: j.job_code,
    job_name: j.job_name,
    pickup_address: j.pickup_address,
    pickup_latitude: numOrNull(j.pickup_latitude),
    pickup_longitude: numOrNull(j.pickup_longitude),
    delivery_address: j.delivery_address,
    delivery_latitude: numOrNull(j.delivery_latitude),
    delivery_longitude: numOrNull(j.delivery_longitude),
    vehicle_id: idOrNull(j.vehicle_id),
    driver_id: idOrNull(j.driver_id),
    scheduled_start_at: isoOrNull(j.scheduled_start_at),
    scheduled_end_at: isoOrNull(j.scheduled_end_at),
    actual_start_at: isoOrNull(j.actual_start_at),
    actual_end_at: isoOrNull(j.actual_end_at),
    job_status: j.job_status,
    problem_note: j.problem_note,
    created_by: String(j.created_by),
    created_at: j.created_at.toISOString(),
    updated_at: j.updated_at.toISOString(),
  };
}
