import { ApiError } from "@vayro/service-kit";
import { workspaceStatus } from "../adapters/company-service";
import { effectiveRateLimit, parseApiKey, secretMatches } from "../domain/api-key";
import { RateLimiter } from "../domain/rate-limit";
import { prisma } from "../lib/prisma";
import * as integrations from "../modules/integrations/integrations.repository";

const limiter = new RateLimiter(60_000);
const TOUCH_EVERY_MS = 60_000; // last_used_at is refreshed at most once a minute per key, not on every call

export interface VerifiedKey {
  integration_id: string;
  company_id: string;
  permissions: string[];
  rate_limit: { limit: number; remaining: number; reset_at: string };
}

// The check an external client's request must pass before anything is processed (PDF page 26):
// the key is real and active, the company's workspace is active, the permission is granted, and the rate limit is not used up.
// Failures never say which part of a key was wrong.
export async function verifyApiKey(rawKey: string, permission?: string): Promise<VerifiedKey> {
  const invalid = () => new ApiError(401, "INVALID_API_KEY", "Invalid API key");
  const parsed = parseApiKey(rawKey);
  if (!parsed) throw invalid();
  const found = (await integrations.findByPrefix(prisma, parsed.prefix)).find((row) => secretMatches(parsed.secret, row.api_key_hash));
  if (!found) throw invalid();
  if (found.integration_status === "revoked") throw new ApiError(401, "API_KEY_REVOKED", "This API key has been revoked");
  if (found.integration_status === "disabled") throw new ApiError(403, "API_KEY_DISABLED", "This API key is disabled");

  const workspace = await workspaceStatus(String(found.company_id));
  if (workspace !== "active") throw new ApiError(403, "WORKSPACE_INACTIVE", "The company workspace is not active");

  const permissions = found.permissions as string[];
  if (permission && !permissions.includes(permission)) throw new ApiError(403, "PERMISSION_DENIED", `This API key does not have the ${permission} permission`);

  const decision = limiter.hit(`integration:${found.integration_id}`, effectiveRateLimit(found.rate_limit_per_minute));
  if (!decision.allowed) {
    const seconds = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));
    throw new ApiError(429, "RATE_LIMITED", `Rate limit of ${decision.limit} requests per minute exceeded; retry in ${seconds} seconds`);
  }

  const now = new Date();
  if (!found.last_used_at || now.getTime() - found.last_used_at.getTime() >= TOUCH_EVERY_MS) await integrations.touch(prisma, found.integration_id, now);
  return {
    integration_id: String(found.integration_id),
    company_id: String(found.company_id),
    permissions,
    rate_limit: { limit: decision.limit, remaining: decision.remaining, reset_at: new Date(decision.resetAt).toISOString() },
  };
}
