-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "gps_locations" (
    "gps_location_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "vehicle_id" BIGINT NOT NULL,
    "gps_device_id" BIGINT,
    "external_record_id" VARCHAR(100),
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "speed_kmh" DECIMAL(7,2),
    "direction_degree" SMALLINT,
    "accuracy_meters" DECIMAL(8,2),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_locations_pkey" PRIMARY KEY ("gps_location_id")
);

-- CreateIndex
CREATE INDEX "gps_locations_vehicle_time_idx" ON "gps_locations"("company_id", "vehicle_id", "recorded_at");

-- CreateIndex
CREATE INDEX "gps_locations_device_received_idx" ON "gps_locations"("gps_device_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "gps_locations_gps_device_id_external_record_id_key" ON "gps_locations"("gps_device_id", "external_record_id");

-- Constraints Prisma cannot express (Data Dictionary rules).
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_latitude_check" CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_longitude_check" CHECK (longitude BETWEEN -180 AND 180);
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_speed_check" CHECK (speed_kmh >= 0);
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_direction_check" CHECK (direction_degree BETWEEN 0 AND 359);
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_accuracy_check" CHECK (accuracy_meters >= 0);
