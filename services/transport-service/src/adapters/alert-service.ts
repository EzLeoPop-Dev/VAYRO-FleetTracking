import { internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const alerts = config.alertServiceUrl ? internalClient(config.alertServiceUrl, config.internalToken) : null;

export interface AlertRequest {
  company_id: string;
  alert_type: "job_assignment" | "system_anomaly";
  title: string;
  detail?: string;
  vehicle_id?: string | null;
  job_id?: string;
  recipient_user_id?: string | null;
  event_data?: Record<string, unknown>;
}

// Both calls are best effort: a job change must never fail or wait because alert-service is down. Failures are only logged.
export async function raiseAlert(alert: AlertRequest): Promise<void> {
  if (!alerts) return;
  try {
    const { status } = await alerts("POST", "/internal/alerts", { body: alert });
    if (status < 200 || status >= 300) console.error(`alert-service answered ${status} for job ${alert.job_id}`);
  } catch (err) {
    console.error("alert-service unreachable:", err instanceof Error ? err.message : "unknown error");
  }
}

// The vehicle's job ended, so silence from its phone is expected: stop the "GPS offline" check until it reports again.
export async function pauseOfflineCheck(companyId: string, vehicleId: string): Promise<void> {
  if (!alerts) return;
  try {
    await alerts("POST", "/internal/signal/pause", { body: { company_id: companyId, vehicle_id: vehicleId } });
  } catch (err) {
    console.error("alert-service unreachable:", err instanceof Error ? err.message : "unknown error");
  }
}
