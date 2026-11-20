-- CreateTable
CREATE TABLE "vehicle_signal_state" (
    "vehicle_id" BIGINT NOT NULL,
    "company_id" BIGINT NOT NULL,
    "last_recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "last_received_at" TIMESTAMPTZ(6) NOT NULL,
    "last_latitude" DECIMAL(10,7) NOT NULL,
    "last_longitude" DECIMAL(10,7) NOT NULL,
    "inside_geofence_ids" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "baseline_set" BOOLEAN NOT NULL DEFAULT false,
    "offline_alerted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_signal_state_pkey" PRIMARY KEY ("vehicle_id")
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
CREATE INDEX "vehicle_signal_state_company_idx" ON "vehicle_signal_state"("company_id", "last_received_at");

-- CreateIndex
CREATE INDEX "system_log_company_idx" ON "system_log"("company_id", "created_at");

-- Constraints Prisma cannot express.
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_result_check" CHECK (result IN ('success', 'failure'));
ALTER TABLE "vehicle_signal_state" ADD CONSTRAINT "vehicle_signal_state_lat_check" CHECK (last_latitude BETWEEN -90 AND 90);
ALTER TABLE "vehicle_signal_state" ADD CONSTRAINT "vehicle_signal_state_lon_check" CHECK (last_longitude BETWEEN -180 AND 180);
