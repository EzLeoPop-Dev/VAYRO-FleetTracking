import { ApiError } from "@vayro/service-kit";

// Pure device rules: no database, no HTTP.

export const DELAYED_AFTER_MS = 5 * 60 * 1000;

export type ConnectionStatus = "connected" | "disconnected" | "error";
export type Settings = Record<string, unknown>;

const isRecord = (value: unknown): value is Settings => typeof value === "object" && value !== null && !Array.isArray(value);

// connection_config is plain JSON; secrets must never be stored in it.
function containsCredential(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCredential);
  return isRecord(value) && Object.entries(value).some(([key, item]) => /(credential|secret|password|token|api[_-]?key)/i.test(key) || containsCredential(item));
}

export function validateSettings(value?: Settings | null) {
  if (containsCredential(value)) throw new ApiError(422, "CREDENTIALS_NOT_SUPPORTED", "Do not send credentials in connection_config");
  if (value?.disabled !== undefined && typeof value.disabled !== "boolean") throw new ApiError(422, "VALIDATION_ERROR", "connection_config.disabled must be boolean");
}

export const settingsOf = (config: unknown): Settings | null => (isRecord(config) ? config : null);
export const isDisabled = (config: unknown) => settingsOf(config)?.disabled === true;

// A device is "connected" only while it has reported recently and has not been disabled.
export function connectionStatus(device: { connection_config: unknown; connection_status: ConnectionStatus; last_received_at: Date | null }): ConnectionStatus {
  const recent = device.last_received_at !== null && Date.now() - device.last_received_at.getTime() <= DELAYED_AFTER_MS;
  if (isDisabled(device.connection_config)) return "disconnected";
  return device.connection_status === "error" ? "error" : recent ? "connected" : "disconnected";
}
