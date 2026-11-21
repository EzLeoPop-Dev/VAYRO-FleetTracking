import type { Sources } from "../adapters/sources";
import { gpsStatus, lastDays } from "../domain/rules";

// A figure that could not be collected is shown as unavailable instead of making the whole dashboard fail or, worse,
// showing a zero that looks real (AGENTS: label what is unavailable, do not invent it).
export type Section<T> = ({ available: true } & T) | { available: false; reason: string };

async function section<T extends object>(source: string, load: () => Promise<T>): Promise<Section<T>> {
  try {
    return { available: true, ...(await load()) };
  } catch (err) {
    console.error(`dashboard section from ${source} failed:`, err instanceof Error ? err.message : "unknown error");
    return { available: false, reason: `${source} is unavailable` };
  }
}

// PDF page 25: overview for the Platform Admin. Platform-wide numbers only; nothing about a single company's people or jobs.
export async function platformDashboard(sources: Sources, days: number, now = new Date()) {
  const window = lastDays(days, now);
  const [companies, users, vehicles, gps_devices, jobs, alerts] = await Promise.all([
    section("company-service", () => sources.companyStats()),
    section("user-service", () => sources.userStats()),
    section("vehicle-service", () => sources.vehicleStats()),
    section("gps-device-service", () => sources.deviceStats()),
    section("transport-service", () => sources.jobStats(undefined, window.from, window.to)),
    section("alert-service", () => sources.alertStats(undefined, window.from, window.to)),
  ]);
  return { generated_at: now.toISOString(), window: { from: window.from.toISOString(), to: window.to.toISOString(), days }, companies, users, vehicles, gps_devices, jobs, alerts };
}

// PDF page 25: overview of one company for its Company Admin, and "jobs and vehicle status" for a Dispatcher.
// A Dispatcher does not get the user counts.
export async function companyDashboard(sources: Sources, role: string, companyId: string, days: number, now = new Date()) {
  const window = lastDays(days, now);
  const vehicleStats = sources.vehicleStats(companyId); // shared by the two sections that need the vehicle total
  vehicleStats.catch(() => undefined);
  const [vehicles, gps, gps_devices, jobs, alerts, users] = await Promise.all([
    section("vehicle-service", () => vehicleStats),
    // GPS status per vehicle comes from the time data was last received, not from a stored flag.
    section("vehicle-service or gps-data-service", async () => {
      const [fleet, latest] = await Promise.all([vehicleStats, sources.latestByVehicle(companyId)]);
      const counts = { current: 0, delayed: 0 };
      for (const point of latest) counts[gpsStatus(point.received_at, now) === "current" ? "current" : "delayed"]++;
      return { vehicles_total: fleet.total, ...counts, no_data: Math.max(0, fleet.total - counts.current - counts.delayed) };
    }),
    section("gps-device-service", () => sources.deviceStats(companyId)),
    section("transport-service", () => sources.jobStats(companyId, window.from, window.to)),
    section("alert-service", () => sources.alertStats(companyId, window.from, window.to)),
    role === "dispatcher" ? Promise.resolve(undefined) : section("user-service", () => sources.userStats(companyId)),
  ]);
  return {
    company_id: companyId,
    generated_at: now.toISOString(),
    window: { from: window.from.toISOString(), to: window.to.toISOString(), days },
    vehicles,
    gps,
    gps_devices,
    jobs,
    alerts,
    ...(users ? { users } : {}),
  };
}
