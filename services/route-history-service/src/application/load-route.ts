import { ApiError, parseId, type Caller } from "@vayro/service-kit";
import { driverWindows } from "../adapters/transport-service";
import { fetchPage } from "../adapters/gps-data";
import { vehicleInCompany } from "../adapters/vehicle-service";
import { clipWindows, MAX_PAGES, mergePages, nextPageEnd, resolveRange, type RoutePoint, type Window } from "../domain/route";

export interface RouteQuery { from?: string; to?: string }
export interface LoadedRoute {
  vehicle_id: string;
  from: string;
  to: string;
  points: RoutePoint[]; // oldest first
  truncated: boolean; // the range had more points than one request returns; the oldest ones are missing
  windows: { from: string; to: string }[] | null; // for a driver: the stretches of their own jobs that were read
}

// Reads one window by walking back from its end, one gps-data-service page at a time.
async function readWindow(companyId: string, vehicleId: string, window: Window, budget: { pages: number }) {
  const pages: RoutePoint[][] = [];
  const seen = new Set<string>();
  let end = window.to, truncated = false;
  for (;;) {
    if (budget.pages <= 0) { truncated = true; break; }
    budget.pages--;
    const page = await fetchPage(companyId, vehicleId, window.from, end);
    const next = nextPageEnd(page, seen);
    for (const p of page) seen.add(p.gps_location_id);
    pages.push(page);
    if (!next) break;
    end = next;
  }
  return { points: mergePages(pages), truncated };
}

// Company Admin and Dispatcher read any vehicle of their company. A Driver reads only the stretches of their own jobs on that vehicle.
export async function loadRoute(me: Caller, vehicleId: string, q: RouteQuery): Promise<LoadedRoute> {
  parseId(vehicleId);
  const range = resolveRange(q.from, q.to);
  if ("problem" in range) throw new ApiError(422, "VALIDATION_ERROR", range.problem);
  const companyId = me.company_id!;
  if (!(await vehicleInCompany(companyId, vehicleId))) throw new ApiError(404, "NOT_FOUND", "Vehicle not found in this company");

  let windows: Window[] = [{ from: range.from, to: range.to }];
  const isDriver = me.role === "driver";
  if (isDriver) windows = clipWindows(range, await driverWindows(companyId, me.user_id, vehicleId, range.from, range.to));

  const budget = { pages: MAX_PAGES };
  const all: RoutePoint[][] = [];
  let truncated = false;
  for (const window of windows) {
    const read = await readWindow(companyId, vehicleId, window, budget);
    all.push(read.points);
    truncated ||= read.truncated;
  }
  return {
    vehicle_id: vehicleId,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    points: mergePages(all),
    truncated,
    windows: isDriver ? windows.map((w) => ({ from: w.from.toISOString(), to: w.to.toISOString() })) : null,
  };
}
