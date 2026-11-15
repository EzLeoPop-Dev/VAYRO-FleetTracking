-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "alert_rule_type" AS ENUM ('gps_offline', 'overspeed');

-- CreateEnum
CREATE TYPE "alert_type" AS ENUM ('gps_offline', 'overspeed', 'geofence_enter', 'geofence_exit', 'system_anomaly', 'job_assignment');

-- CreateEnum
CREATE TYPE "alert_status" AS ENUM ('unread', 'read', 'handling', 'resolved');

-- CreateEnum
CREATE TYPE "geofence_status" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "geofences" (
    "geofence_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "geofence_name" VARCHAR(120) NOT NULL,
    "center_latitude" DECIMAL(10,7) NOT NULL,
    "center_longitude" DECIMAL(10,7) NOT NULL,
    "radius_meters" BIGINT NOT NULL,
    "notify_enter" BOOLEAN NOT NULL DEFAULT true,
    "notify_exit" BOOLEAN NOT NULL DEFAULT true,
    "geofence_status" "geofence_status" NOT NULL DEFAULT 'active',
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("geofence_id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "alert_rule_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "rule_type" "alert_rule_type" NOT NULL,
    "threshold_value" DECIMAL(10,2),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("alert_rule_id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "alert_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "vehicle_id" BIGINT,
    "job_id" BIGINT,
    "geofence_id" BIGINT,
    "recipient_user_id" BIGINT,
    "alert_type" "alert_type" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "detail" TEXT,
    "event_data" JSONB,
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alert_status" "alert_status" NOT NULL DEFAULT 'unread',
    "handled_by" BIGINT,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_id")
);

-- CreateIndex
CREATE INDEX "geofences_company_status_idx" ON "geofences"("company_id", "geofence_status");

-- CreateIndex
CREATE UNIQUE INDEX "alert_rules_company_id_rule_type_key" ON "alert_rules"("company_id", "rule_type");

-- CreateIndex
CREATE INDEX "alerts_company_status_time_idx" ON "alerts"("company_id", "alert_status", "triggered_at");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences"("geofence_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints Prisma cannot express (Data Dictionary rules).
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_center_latitude_check" CHECK (center_latitude BETWEEN -90 AND 90);
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_center_longitude_check" CHECK (center_longitude BETWEEN -180 AND 180);
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_radius_check" CHECK (radius_meters BETWEEN 0 AND 4294967295);
