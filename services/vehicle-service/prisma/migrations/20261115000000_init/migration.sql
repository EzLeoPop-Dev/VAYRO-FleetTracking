-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "vehicle_status" AS ENUM ('active', 'inactive', 'maintenance');

-- CreateTable
CREATE TABLE "vehicle_types" (
    "vehicle_type_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "type_name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("vehicle_type_id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "vehicle_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "vehicle_type_id" BIGINT,
    "vehicle_code" VARCHAR(50) NOT NULL,
    "license_plate" VARCHAR(30) NOT NULL,
    "vehicle_status" "vehicle_status" NOT NULL DEFAULT 'active',
    "current_driver_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("vehicle_id")
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
CREATE UNIQUE INDEX "vehicle_types_company_id_type_name_key" ON "vehicle_types"("company_id", "type_name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_company_id_vehicle_code_key" ON "vehicles"("company_id", "vehicle_code");

-- CreateIndex
CREATE INDEX "system_log_company_idx" ON "system_log"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("vehicle_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints Prisma cannot express (Data Dictionary rules).
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_result_check" CHECK (result IN ('success', 'failure'));
