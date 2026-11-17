import { ApiError, internalClient, internalToken, required, type InternalClient } from "@vayro/service-kit";

// Where the numbers come from. reporting-service stores nothing: every figure is asked from the service that owns the data,
// over its read-only /internal API. Behind an interface so tests can replace all of it with fakes.

export interface Counts { total: number; by_status: Record<string, number> }
export interface UserStats { total: number; by_role: Record<string, number>; by_status: Record<string, number> }
export interface VehicleStats extends Counts { with_driver: number }
export interface DeviceStats { total: number; by_connection_status: Record<string, number>; disabled: number }
export interface JobStats extends Counts { avg_duration_minutes: number | null }
export interface AlertStats { total: number; by_type: Record<string, number>; by_status: Record<string, number>; open_total: number; avg_resolution_minutes: number | null }

export interface VehicleRow { vehicle_id: string; vehicle_code: string; license_plate: string; vehicle_type: string | null; vehicle_status: string; current_driver_id: string | null }
export interface DeviceRow { gps_device_id: string; vehicle_id: string; device_code: string; source_type: string; connection_status: string; last_received_at: string | null; disabled: boolean }
export interface LatestPoint { vehicle_id: string; latitude: number; longitude: number; speed_kmh: number | null; recorded_at: string; received_at: string }
export interface GpsVehicleStat {
  vehicle_id: string; points: number; distance_km: number; avg_speed_kmh: number | null; max_speed_kmh: number | null;
  first_recorded_at: string; last_recorded_at: string; last_received_at: string; gaps: number; anomalies: number; null_island: number; impossible_speed: number; late_points: number;
}
export interface JobRow {
  job_id: string; job_code: string; job_name: string | null; job_status: string; pickup_address: string; delivery_address: string; vehicle_id: string | null; driver_id: string | null;
  scheduled_start_at: string | null; scheduled_end_at: string | null; actual_start_at: string | null; actual_end_at: string | null; created_at: string; duration_minutes: number | null; has_problem: boolean;
}
export interface AlertRow {
  alert_id: string; alert_type: string; title: string; alert_status: string; vehicle_id: string | null; job_id: string | null; geofence_id: string | null;
  triggered_at: string; handled_by: string | null; resolved_at: string | null; resolution_minutes: number | null;
}
export interface Page<T> { total: number; rows: T[] }
export interface Paging { limit: number; offset: number }

export interface Sources {
  /** Does the company exist? (false = unknown id.) */
  companyExists(companyId: string): Promise<boolean>;
  companyStats(): Promise<Counts>;
  userStats(companyId?: string): Promise<UserStats>;
  vehicleStats(companyId?: string): Promise<VehicleStats>;
  vehicles(companyId: string, q: Paging & { status?: string; vehicleId?: string }): Promise<Page<VehicleRow>>;
  deviceStats(companyId?: string): Promise<DeviceStats>;
  devices(companyId: string, vehicleIds: string[]): Promise<DeviceRow[]>;
  /** The newest point of each vehicle; all vehicles of the company when vehicleIds is omitted. */
  latestByVehicle(companyId: string, vehicleIds?: string[]): Promise<LatestPoint[]>;
  /** Per-vehicle aggregates over [from, to]; vehicles with no point in the window are absent. */
  gpsStats(companyId: string, from: Date, to: Date, vehicleIds?: string[]): Promise<GpsVehicleStat[]>;
  jobStats(companyId: string | undefined, from?: Date, to?: Date): Promise<JobStats>;
  jobs(companyId: string, q: Paging & { from?: Date; to?: Date; status?: string }): Promise<Page<JobRow>>;
  alertStats(companyId: string | undefined, from?: Date, to?: Date): Promise<AlertStats>;
  alerts(companyId: string, q: Paging & { from?: Date; to?: Date; type?: string; status?: string }): Promise<Page<AlertRow>>;
}

const query = (params: Record<string, string | number | Date | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, value instanceof Date ? value.toISOString() : String(value));
  return `?${search}`;
};

export function httpSources(): Sources {
  const token = internalToken();
  const client = (env: string) => internalClient(required(env), token, 8000); // reports can take longer than a lookup
  const company = client("COMPANY_SERVICE_URL"), users = client("USER_SERVICE_URL"), vehicles = client("VEHICLE_SERVICE_URL"), devices = client("GPS_DEVICE_SERVICE_URL");
  const gps = client("GPS_DATA_SERVICE_URL"), transport = client("TRANSPORT_SERVICE_URL"), alerts = client("ALERT_SERVICE_URL");

  async function get<T>(service: string, call: InternalClient, path: string, params: Record<string, string | number | Date | undefined> = {}): Promise<T> {
    const { status, body } = await call("GET", path + query(params));
    if (status !== 200 || body?.data === undefined) throw new ApiError(502, "UPSTREAM_ERROR", `${service} returned ${status}`);
    return body.data as T;
  }

  async function companyExists(companyId: string): Promise<boolean> {
    const { status } = await company("GET", `/internal/companies/${companyId}`);
    if (status === 404) return false;
    if (status !== 200) throw new ApiError(502, "UPSTREAM_ERROR", `company-service returned ${status}`);
    return true;
  }

  return {
    companyExists,
    companyStats: () => get("company-service", company, "/internal/stats/companies"),
    userStats: (companyId) => get("user-service", users, "/internal/stats/users", { company_id: companyId }),
    vehicleStats: (companyId) => get("vehicle-service", vehicles, "/internal/stats/vehicles", { company_id: companyId }),
    vehicles: (companyId, q) => get("vehicle-service", vehicles, "/internal/vehicles", { company_id: companyId, status: q.status, vehicle_id: q.vehicleId, limit: q.limit, offset: q.offset }),
    deviceStats: (companyId) => get("gps-device-service", devices, "/internal/stats/devices", { company_id: companyId }),
    devices: (companyId, ids) => get("gps-device-service", devices, "/internal/devices", { company_id: companyId, vehicle_ids: ids.join(",") }),
    latestByVehicle: (companyId, ids) => get("gps-data-service", gps, "/internal/locations/latest-by-vehicle", { company_id: companyId, vehicle_ids: ids?.join(",") }),
    gpsStats: (companyId, from, to, ids) => get("gps-data-service", gps, "/internal/stats/vehicles", { company_id: companyId, from, to, vehicle_ids: ids?.join(",") }),
    jobStats: (companyId, from, to) => get("transport-service", transport, "/internal/stats/jobs", { company_id: companyId, from, to }),
    jobs: (companyId, q) => get("transport-service", transport, "/internal/jobs", { company_id: companyId, from: q.from, to: q.to, status: q.status, limit: q.limit, offset: q.offset }),
    alertStats: (companyId, from, to) => get("alert-service", alerts, "/internal/stats/alerts", { company_id: companyId, from, to }),
    alerts: (companyId, q) => get("alert-service", alerts, "/internal/alerts", { company_id: companyId, from: q.from, to: q.to, type: q.type, status: q.status, limit: q.limit, offset: q.offset }),
  };
}
