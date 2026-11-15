-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "integration_status" AS ENUM ('active', 'revoked', 'disabled');

-- CreateTable
CREATE TABLE "api_integrations" (
    "integration_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "integration_name" VARCHAR(120) NOT NULL,
    "api_key_prefix" VARCHAR(20) NOT NULL,
    "api_key_hash" VARCHAR(255) NOT NULL,
    "permissions" JSONB NOT NULL,
    "rate_limit_per_minute" BIGINT,
    "integration_status" "integration_status" NOT NULL DEFAULT 'active',
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_integrations_pkey" PRIMARY KEY ("integration_id")
);

-- CreateTable
CREATE TABLE "api_request_logs" (
    "api_log_id" BIGSERIAL NOT NULL,
    "integration_id" BIGINT,
    "company_id" BIGINT NOT NULL,
    "http_method" VARCHAR(10) NOT NULL,
    "endpoint" VARCHAR(255) NOT NULL,
    "http_status" INTEGER,
    "request_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" BIGINT,
    "request_id" VARCHAR(100),
    "source_ip" VARCHAR(45),

    CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("api_log_id")
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
CREATE INDEX "api_request_logs_company_time_idx" ON "api_request_logs"("company_id", "request_at");

-- CreateIndex
CREATE INDEX "system_log_company_idx" ON "system_log"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "api_integrations"("integration_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints Prisma cannot express (Data Dictionary rules).
ALTER TABLE "api_integrations" ADD CONSTRAINT "api_integrations_rate_limit_check" CHECK (rate_limit_per_minute BETWEEN 0 AND 4294967295);
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_http_status_check" CHECK (http_status BETWEEN 0 AND 65535);
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_duration_check" CHECK (duration_ms BETWEEN 0 AND 4294967295);
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_result_check" CHECK (result IN ('success', 'failure'));
