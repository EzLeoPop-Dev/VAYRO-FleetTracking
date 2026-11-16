import { integer, internalToken, required } from "@vayro/service-kit";

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");

export const config = {
  databaseUrl: required("DATABASE_URL"),
  userServiceUrl: required("USER_SERVICE_URL"),
  companyServiceUrl: required("COMPANY_SERVICE_URL"),
  internalToken: internalToken(),
  jwtSecret,
  accessTtlSeconds: integer("ACCESS_TOKEN_TTL_SECONDS", 15 * 60, 1, 31536000),
  refreshTtlSeconds: integer("REFRESH_TOKEN_TTL_SECONDS", 7 * 24 * 60 * 60, 1, 31536000),
};
