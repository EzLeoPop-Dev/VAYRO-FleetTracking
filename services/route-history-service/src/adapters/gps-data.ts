import { ApiError, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";
import { PAGE_SIZE, type RoutePoint } from "../domain/route";

const gps = internalClient(config.gpsDataServiceUrl, config.internalToken);

// The newest PAGE_SIZE stored points of one vehicle in [from, to], oldest first. The vehicle must already be checked as the caller's.
export async function fetchPage(companyId: string, vehicleId: string, from: Date, to: Date): Promise<RoutePoint[]> {
  const query = new URLSearchParams({ company_id: companyId, vehicle_id: vehicleId, from: from.toISOString(), to: to.toISOString(), limit: String(PAGE_SIZE) });
  const { status, body } = await gps("GET", `/internal/locations?${query}`);
  if (status !== 200 || !Array.isArray(body?.data)) throw new ApiError(502, "UPSTREAM_ERROR", `GPS data service returned ${status}`);
  return (body.data as Record<string, unknown>[]).map((row) => ({
    gps_location_id: String(row.gps_location_id),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    speed_kmh: row.speed_kmh === null || row.speed_kmh === undefined ? null : Number(row.speed_kmh),
    direction_degree: row.direction_degree === null || row.direction_degree === undefined ? null : Number(row.direction_degree),
    accuracy_meters: row.accuracy_meters === null || row.accuracy_meters === undefined ? null : Number(row.accuracy_meters),
    recorded_at: String(row.recorded_at),
    freshness: String(row.freshness),
    anomalies: Array.isArray(row.anomalies) ? (row.anomalies as string[]) : [],
  }));
}
