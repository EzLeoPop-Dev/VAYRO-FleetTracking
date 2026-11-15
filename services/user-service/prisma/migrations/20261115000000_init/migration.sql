-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('platform_admin', 'company_admin', 'dispatcher', 'driver');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active', 'inactive', 'suspended');

-- CreateTable
CREATE TABLE "users" (
    "user_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL,
    "phone" VARCHAR(30),
    "account_status" "account_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "system_log_company_idx" ON "system_log"("company_id", "created_at");

-- Constraints Prisma cannot express (Data Dictionary rules).
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK (email = lower(email));
-- platform_admin has no company; every other role must belong to one
ALTER TABLE "users" ADD CONSTRAINT "users_role_company_check" CHECK ((role = 'platform_admin') = (company_id IS NULL));
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_result_check" CHECK (result IN ('success', 'failure'));
