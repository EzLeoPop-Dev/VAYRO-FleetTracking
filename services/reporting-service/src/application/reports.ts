import { ApiError } from "@vayro/service-kit";
import type { AlertRow, DeviceRow, GpsVehicleStat, JobRow, LatestPoint, Sources, VehicleRow } from "../adapters/sources";
import type { Column } from "../domain/csv";
import { gpsStatus, MAX_EXPORT_ROWS } from "../domain/rules";

// The five reports of PDF page 25. Each one is a ReportDef: how to fetch one page, and which columns a CSV export has.
// Every number is computed from the owning services' data at request time; nothing is stored here.

export interface ReportDef<Row> {
  name: string;
  /** How many rows one upstream page may hold (vehicle-based reports are limited by the id lists they send on). */
  chunk: number;
  columns: Column<Row>[];
  fetch(offset: number, limit: number): Promise<{ total: number; summary: object; rows: Row[] }>;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (n: number, digits = 3) => Number(n.toFixed(digits));
const period = (from: Date, to: Date) => ({ from: from.toISOString(), to: to.toISOString() });
const once = <T>(load: () => Promise<T>) => { let p: Promise<T> | undefined; return () => (p ??= load()); }; // CSV export fetches page after page

// ---------------------------------------------------------------- 1. vehicles
export interface VehicleReportRow extends VehicleRow {
  gps_status: string; last_recorded_at: string | null; last_received_at: string | null; latitude: number | null; longitude: number | null; speed_kmh: number | null;
  device_count: number; devices_connected: number; devices: { device_code: string; source_type: string; connection_status: string; last_received_at: string | null }[];
}

export function vehiclesReport(sources: Sources, companyId: string, f: { status?: string }, now = new Date()): ReportDef<VehicleReportRow> {
  const fleet = once(() => sources.vehicleStats(companyId));
  return {
    name: "report-vehicles",
    chunk: 100,
    columns: [
      { header: "vehicle_id", value: (r) => r.vehicle_id }, { header: "vehicle_code", value: (r) => r.vehicle_code }, { header: "license_plate", value: (r) => r.license_plate },
      { header: "vehicle_type", value: (r) => r.vehicle_type }, { header: "vehicle_status", value: (r) => r.vehicle_status }, { header: "current_driver_id", value: (r) => r.current_driver_id },
      { header: "gps_status", value: (r) => r.gps_status }, { header: "last_recorded_at", value: (r) => r.last_recorded_at }, { header: "last_received_at", value: (r) => r.last_received_at },
      { header: "latitude", value: (r) => r.latitude }, { header: "longitude", value: (r) => r.longitude }, { header: "speed_kmh", value: (r) => r.speed_kmh },
      { header: "device_count", value: (r) => r.device_count }, { header: "devices_connected", value: (r) => r.devices_connected },
    ],
    async fetch(offset, limit) {
      const [list, stats] = await Promise.all([sources.vehicles(companyId, { status: f.status, limit, offset }), fleet()]);
      const ids = list.rows.map((v) => v.vehicle_id);
      const [latest, devices] = ids.length ? await Promise.all([sources.latestByVehicle(companyId, ids), sources.devices(companyId, ids)]) : [[], []];
      const point = new Map(latest.map((p) => [p.vehicle_id, p]));
      const rows = list.rows.map((v): VehicleReportRow => {
        const p = point.get(v.vehicle_id);
        const own = devices.filter((d) => d.vehicle_id === v.vehicle_id);
        return {
          ...v,
          gps_status: gpsStatus(p?.received_at, now), last_recorded_at: p?.recorded_at ?? null, last_received_at: p?.received_at ?? null,
          latitude: p?.latitude ?? null, longitude: p?.longitude ?? null, speed_kmh: p?.speed_kmh ?? null,
          device_count: own.length, devices_connected: own.filter((d) => d.connection_status === "connected").length,
          devices: own.map((d) => ({ device_code: d.device_code, source_type: d.source_type, connection_status: d.connection_status, last_received_at: d.last_received_at })),
        };
      });
      return { total: list.total, summary: { total_matching: list.total, fleet_total: stats.total, fleet_by_status: stats.by_status, generated_at: now.toISOString() }, rows };
    },
  };
}

// ---------------------------------------------------------------- 2. routes (distance and speed)
export interface RouteReportRow extends VehicleRow {
  points: number; distance_km: number; avg_speed_kmh: number | null; max_speed_kmh: number | null; first_recorded_at: string | null; last_recorded_at: string | null;
}

const NO_STATS = { points: 0, distance_km: 0, avg_speed_kmh: null, max_speed_kmh: null, first_recorded_at: null, last_recorded_at: null };

export function routesReport(sources: Sources, companyId: string, f: { from: Date; to: Date; vehicleId?: string }): ReportDef<RouteReportRow> {
  const stats = once(() => sources.gpsStats(companyId, f.from, f.to, f.vehicleId ? [f.vehicleId] : undefined));
  return {
    name: "report-routes",
    chunk: 100,
    columns: [
      { header: "vehicle_id", value: (r) => r.vehicle_id }, { header: "vehicle_code", value: (r) => r.vehicle_code }, { header: "license_plate", value: (r) => r.license_plate },
      { header: "points", value: (r) => r.points }, { header: "distance_km", value: (r) => r.distance_km }, { header: "avg_speed_kmh", value: (r) => r.avg_speed_kmh },
      { header: "max_speed_kmh", value: (r) => r.max_speed_kmh }, { header: "first_recorded_at", value: (r) => r.first_recorded_at }, { header: "last_recorded_at", value: (r) => r.last_recorded_at },
    ],
    async fetch(offset, limit) {
      const [list, all] = await Promise.all([sources.vehicles(companyId, { vehicleId: f.vehicleId, limit, offset }), stats()]);
      if (f.vehicleId && list.total === 0) throw new ApiError(404, "NOT_FOUND", "Vehicle not found in this company");
      const byVehicle = new Map(all.map((s) => [s.vehicle_id, s]));
      const rows = list.rows.map((v): RouteReportRow => {
        const s = byVehicle.get(v.vehicle_id);
        return { ...v, ...(s ? { points: s.points, distance_km: s.distance_km, avg_speed_kmh: s.avg_speed_kmh, max_speed_kmh: s.max_speed_kmh, first_recorded_at: s.first_recorded_at, last_recorded_at: s.last_recorded_at } : NO_STATS) };
      });
      return {
        total: list.total,
        summary: {
          period: period(f.from, f.to), vehicles_total: list.total, vehicles_with_data: all.length, total_points: sum(all.map((s) => s.points)), total_distance_km: round(sum(all.map((s) => s.distance_km))),
          // Distance is straight lines between consecutive stored points, leaving out moves above 250 km/h (bad fixes): an approximation.
          distance_is_approximate: true, complete: all.length < 500,
        },
        rows,
      };
    },
  };
}

// ---------------------------------------------------------------- 3. jobs
export function jobsReport(sources: Sources, companyId: string, f: { from: Date; to: Date; status?: string }): ReportDef<JobRow> {
  return {
    name: "report-jobs",
    chunk: 200,
    columns: [
      { header: "job_id", value: (r) => r.job_id }, { header: "job_code", value: (r) => r.job_code }, { header: "job_name", value: (r) => r.job_name }, { header: "job_status", value: (r) => r.job_status },
      { header: "pickup_address", value: (r) => r.pickup_address }, { header: "delivery_address", value: (r) => r.delivery_address }, { header: "vehicle_id", value: (r) => r.vehicle_id }, { header: "driver_id", value: (r) => r.driver_id },
      { header: "scheduled_start_at", value: (r) => r.scheduled_start_at }, { header: "scheduled_end_at", value: (r) => r.scheduled_end_at }, { header: "actual_start_at", value: (r) => r.actual_start_at },
      { header: "actual_end_at", value: (r) => r.actual_end_at }, { header: "duration_minutes", value: (r) => r.duration_minutes }, { header: "has_problem", value: (r) => r.has_problem }, { header: "created_at", value: (r) => r.created_at },
    ],
    async fetch(offset, limit) {
      const [stats, list] = await Promise.all([sources.jobStats(companyId, f.from, f.to), sources.jobs(companyId, { from: f.from, to: f.to, status: f.status, limit, offset })]);
      // A job belongs to the period it was created in.
      return { total: list.total, summary: { period: period(f.from, f.to), total_in_period: stats.total, by_status: stats.by_status, avg_duration_minutes: stats.avg_duration_minutes }, rows: list.rows };
    },
  };
}

// ---------------------------------------------------------------- 4. alerts
export function alertsReport(sources: Sources, companyId: string, f: { from: Date; to: Date; type?: string; status?: string }): ReportDef<AlertRow> {
  return {
    name: "report-alerts",
    chunk: 200,
    columns: [
      { header: "alert_id", value: (r) => r.alert_id }, { header: "alert_type", value: (r) => r.alert_type }, { header: "title", value: (r) => r.title }, { header: "alert_status", value: (r) => r.alert_status },
      { header: "vehicle_id", value: (r) => r.vehicle_id }, { header: "job_id", value: (r) => r.job_id }, { header: "geofence_id", value: (r) => r.geofence_id }, { header: "triggered_at", value: (r) => r.triggered_at },
      { header: "handled_by", value: (r) => r.handled_by }, { header: "resolved_at", value: (r) => r.resolved_at }, { header: "resolution_minutes", value: (r) => r.resolution_minutes },
    ],
    async fetch(offset, limit) {
      const [stats, list] = await Promise.all([sources.alertStats(companyId, f.from, f.to), sources.alerts(companyId, { from: f.from, to: f.to, type: f.type, status: f.status, limit, offset })]);
      // An alert belongs to the period it was triggered in; open_total counts every alert still unresolved, whenever it was triggered.
      return { total: list.total, summary: { period: period(f.from, f.to), total_in_period: stats.total, by_type: stats.by_type, by_status: stats.by_status, open_total: stats.open_total, avg_resolution_minutes: stats.avg_resolution_minutes }, rows: list.rows };
    },
  };
}

// ---------------------------------------------------------------- 5. GPS quality and status
export interface GpsReportRow extends VehicleRow {
  gps_status: string; last_recorded_at: string | null; last_received_at: string | null; points: number; late_points: number; gaps: number; anomalies: number; device_count: number; devices_connected: number;
}

export function gpsReport(sources: Sources, companyId: string, f: { from: Date; to: Date }, now = new Date()): ReportDef<GpsReportRow> {
  const stats = once(() => sources.gpsStats(companyId, f.from, f.to));
  const latestAll = once(() => sources.latestByVehicle(companyId));
  return {
    name: "report-gps",
    chunk: 100,
    columns: [
      { header: "vehicle_id", value: (r) => r.vehicle_id }, { header: "vehicle_code", value: (r) => r.vehicle_code }, { header: "license_plate", value: (r) => r.license_plate },
      { header: "gps_status", value: (r) => r.gps_status }, { header: "last_recorded_at", value: (r) => r.last_recorded_at }, { header: "last_received_at", value: (r) => r.last_received_at },
      { header: "points_in_period", value: (r) => r.points }, { header: "late_points", value: (r) => r.late_points }, { header: "gaps", value: (r) => r.gaps }, { header: "anomalies", value: (r) => r.anomalies },
      { header: "device_count", value: (r) => r.device_count }, { header: "devices_connected", value: (r) => r.devices_connected },
    ],
    async fetch(offset, limit) {
      const [list, all, latest] = await Promise.all([sources.vehicles(companyId, { limit, offset }), stats(), latestAll()]);
      const ids = list.rows.map((v) => v.vehicle_id);
      const devices: DeviceRow[] = ids.length ? await sources.devices(companyId, ids) : [];
      const point = new Map<string, LatestPoint>(latest.map((p) => [p.vehicle_id, p]));
      const stat = new Map<string, GpsVehicleStat>(all.map((s) => [s.vehicle_id, s]));
      const rows = list.rows.map((v): GpsReportRow => {
        const p = point.get(v.vehicle_id), s = stat.get(v.vehicle_id), own = devices.filter((d) => d.vehicle_id === v.vehicle_id);
        return {
          ...v, gps_status: gpsStatus(p?.received_at, now), last_recorded_at: p?.recorded_at ?? null, last_received_at: p?.received_at ?? null,
          points: s?.points ?? 0, late_points: s?.late_points ?? 0, gaps: s?.gaps ?? 0, anomalies: s?.anomalies ?? 0,
          device_count: own.length, devices_connected: own.filter((d) => d.connection_status === "connected").length,
        };
      });
      const statuses = { current: 0, delayed: 0 };
      for (const p of latest) statuses[gpsStatus(p.received_at, now) === "current" ? "current" : "delayed"]++;
      return {
        total: list.total,
        summary: {
          period: period(f.from, f.to), vehicles_total: list.total, vehicles_by_gps_status: { ...statuses, no_data: Math.max(0, list.total - statuses.current - statuses.delayed) },
          vehicles_without_points_in_period: Math.max(0, list.total - all.length),
          total_points: sum(all.map((s) => s.points)), late_points: sum(all.map((s) => s.late_points)), gaps: sum(all.map((s) => s.gaps)), anomalies: sum(all.map((s) => s.anomalies)),
          // "late" = reached the server more than 5 minutes after it was recorded; "gap" = more than 10 minutes without a point;
          // "anomaly" = a (0, 0) position or a move above 250 km/h from the previous point. A device's own "connected" flag is not used for the status.
          complete: all.length < 500,
        },
        rows,
      };
    },
  };
}

// ---------------------------------------------------------------- running a report
export async function collectAll<Row>(def: ReportDef<Row>): Promise<Row[]> {
  const first = await def.fetch(0, def.chunk);
  if (first.total > MAX_EXPORT_ROWS) throw new ApiError(422, "TOO_MANY_ROWS", `The export would have ${first.total} rows; the limit is ${MAX_EXPORT_ROWS}. Narrow the filter or the period.`);
  const rows = [...first.rows];
  while (rows.length < first.total) {
    const next = await def.fetch(rows.length, def.chunk);
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
  }
  return rows;
}
