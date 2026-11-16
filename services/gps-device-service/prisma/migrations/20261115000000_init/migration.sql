-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "gps_source_type" AS ENUM ('gps_device', 'provider_api', 'driver_mobile_app');

-- CreateEnum
CREATE TYPE "gps_connection_status" AS ENUM ('connected', 'disconnected', 'error');

-- CreateTable
CREATE TABLE "gps_devices" (
    "gps_device_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "vehicle_id" BIGINT NOT NULL,
    "device_code" VARCHAR(100) NOT NULL,
    "source_type" "gps_source_type" NOT NULL,
    "provider_name" VARCHAR(120),
    "connection_config" JSONB,
    "credentials_encrypted" TEXT,
    "connection_status" "gps_connection_status" NOT NULL DEFAULT 'disconnected',
    "last_received_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_devices_pkey" PRIMARY KEY ("gps_device_id")
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
CREATE UNIQUE INDEX "gps_devices_company_id_device_code_key" ON "gps_devices"("company_id", "device_code");

-- CreateIndex
CREATE INDEX "system_log_company_idx" ON "system_log"("company_id", "created_at");

-- Constraints Prisma cannot express (Data Dictionary rules).
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_result_check" CHECK (result IN ('success', 'failure'));
