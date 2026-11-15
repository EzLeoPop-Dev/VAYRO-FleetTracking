-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'problem');

-- CreateTable
CREATE TABLE "transport_jobs" (
    "job_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "job_code" VARCHAR(50) NOT NULL,
    "job_name" VARCHAR(150),
    "pickup_address" VARCHAR(255) NOT NULL,
    "pickup_latitude" DECIMAL(10,7),
    "pickup_longitude" DECIMAL(10,7),
    "delivery_address" VARCHAR(255) NOT NULL,
    "delivery_latitude" DECIMAL(10,7),
    "delivery_longitude" DECIMAL(10,7),
    "vehicle_id" BIGINT,
    "driver_id" BIGINT,
    "scheduled_start_at" TIMESTAMPTZ(6),
    "scheduled_end_at" TIMESTAMPTZ(6),
    "actual_start_at" TIMESTAMPTZ(6),
    "actual_end_at" TIMESTAMPTZ(6),
    "job_status" "job_status" NOT NULL DEFAULT 'pending',
    "problem_note" TEXT,
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "system_log" (
    "system_log_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT,
    "user_id" BIGINT,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" VARCHAR(80),
    "old_value" JSONB,
    "new_value" JSONB,
    "result" VARCHAR(10) NOT NULL DEFAULT 'success',
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_log_pkey" PRIMARY KEY ("system_log_id")
);

-- CreateIndex
CREATE INDEX "transport_jobs_active_lookup_idx" ON "transport_jobs"("company_id", "vehicle_id", "driver_id", "job_status");

-- CreateIndex
CREATE UNIQUE INDEX "transport_jobs_company_id_job_code_key" ON "transport_jobs"("company_id", "job_code");

-- CreateIndex
CREATE INDEX "system_log_company_idx" ON "system_log"("company_id", "created_at");

-- Constraints Prisma cannot express (Data Dictionary rules).
ALTER TABLE "transport_jobs" ADD CONSTRAINT "transport_jobs_pickup_lat_check" CHECK (pickup_latitude BETWEEN -90 AND 90);
ALTER TABLE "transport_jobs" ADD CONSTRAINT "transport_jobs_pickup_lon_check" CHECK (pickup_longitude BETWEEN -180 AND 180);
ALTER TABLE "transport_jobs" ADD CONSTRAINT "transport_jobs_delivery_lat_check" CHECK (delivery_latitude BETWEEN -90 AND 90);
ALTER TABLE "transport_jobs" ADD CONSTRAINT "transport_jobs_delivery_lon_check" CHECK (delivery_longitude BETWEEN -180 AND 180);
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_result_check" CHECK (result IN ('success', 'failure'));
