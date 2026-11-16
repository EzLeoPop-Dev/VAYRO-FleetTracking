import { parseId } from "@vayro/service-kit";

// Static credentials for GPS hardware (TRACKING_API_TOKENS). Humans never use these: they sign in through auth-service.
export interface TokenIdentity {
  role: "gps_device";
  company_id: string;
  device_code: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function parseTokenConfig(raw?: string): Map<string, TokenIdentity> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    throw new Error("TRACKING_API_TOKENS must be valid JSON");
  }
  if (!isRecord(parsed)) throw new Error("TRACKING_API_TOKENS must be an object");
  const tokens = new Map<string, TokenIdentity>();
  for (const [token, value] of Object.entries(parsed)) {
    if (token.length < 24 || /\s/.test(token) || !isRecord(value) || value.role !== "gps_device" || typeof value.company_id !== "string" || typeof value.device_code !== "string" || !value.device_code.trim() || value.device_code.length > 100) {
      throw new Error("Device credentials require role=gps_device, company_id as a BIGINT string, and device_code; static user/admin tokens are not allowed");
    }
    parseId(value.company_id);
    tokens.set(token, { role: "gps_device", company_id: value.company_id, device_code: value.device_code.trim() });
  }
  return tokens;
}
