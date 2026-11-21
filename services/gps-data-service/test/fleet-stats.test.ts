// The read-only aggregates reporting-service relies on, against real SQL in gps_data_db.
// Needs DATABASE_URL (gps_data_db). Uses its own unique company ids per run; the rows are kept.
import { describe, expect, test } from "bun:test";
import { ApiError } from "@vayro/service-kit";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the gps_data_db connection string");
process.env.INTERNAL_API_TOKEN ??= "unit-test-internal-token-not-for-deployment-123456";
const { createGpsDataApp } = await import("../src/app");
const { prisma } = await import("../src/lib/prisma");

const run = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 100)) * 10n;
const company = String(run + 1n), other = String(run + 2n);
const v1 = run + 11n, v2 = run + 12n, vOther = run + 13n;
const T0 = new Date(Date.now() - 3 * 3600_000);
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const nobody = async () => { throw new ApiError(401, "UNAUTHORIZED", "no users in this test"); };
const app = createGpsDataApp({ tokens: new Map(), resolveUser: nobody as never, fleet: {} as never, devices: {} as never }).compile();
const token = { "x-internal-token": process.env.INTERNAL_API_TOKEN! };
const get = async (path: string, headers: Record<string, string> = token) => {
  const r = await app.handle(new Request(`http://localhost${path}`, { headers }));
  return { status: r.status, json: await r.json() };
};
const iso = (d: Date) => encodeURIComponent(d.toISOString());

// recorded minute, latitude, longitude, speed, minutes between recorded and received
const point = (vehicle: bigint, comp: string, minute: number, lat: number, lon: number, speed: number | null, delayMin = 0.5) =>
  ({ company_id: BigInt(comp), vehicle_id: vehicle, latitude: lat, longitude: lon, speed_kmh: speed, recorded_at: at(minute), received_at: at(minute + delayMin) });

async function seed() {
  await prisma.gpsLocation.createMany({
    data: [
      // vehicle 1: normal move, a 20 minute gap, a teleport to Chiang Mai, a (0,0) fix, and back
      point(v1, company, 0, 13.7563, 100.5018, 40),
      point(v1, company, 5, 13.7663, 100.5018, 50),
      point(v1, company, 25, 13.7763, 100.5018, 60, 10), // arrived 10 minutes late
      point(v1, company, 26, 18.7883, 98.9853, null),
      point(v1, company, 40, 0, 0, null),
      point(v1, company, 41, 13.7763, 100.5018, 70),
      // vehicle 2: one old point (outside the window) and two recent ones
      { ...point(v2, company, -4000, 13.0, 100.0, 10) },
      point(v2, company, 10, 13.0, 100.0, 10),
      point(v2, company, 12, 13.0, 100.02, 20),
      // another company's vehicle must never show up
      point(vOther, other, 5, 13.0, 100.0, 99),
    ],
  });
}

describe("internal GPS aggregates for reporting-service", () => {
  test("needs the internal token", async () => {
    expect((await get(`/internal/stats/vehicles?company_id=${company}&from=${iso(at(-60))}&to=${iso(at(120))}`, {})).status).toBe(401);
    expect((await get(`/internal/locations/latest-by-vehicle?company_id=${company}`, {})).status).toBe(401);
  });

  test("latest point of every vehicle, one row each, only for that company", async () => {
    await seed();
    const all = await get(`/internal/locations/latest-by-vehicle?company_id=${company}`);
    expect(all.status).toBe(200);
    expect(all.json.data.map((p: any) => p.vehicle_id)).toEqual([String(v1), String(v2)]);
    expect(all.json.data[0]).toMatchObject({ latitude: 13.7763, longitude: 100.5018, speed_kmh: 70, recorded_at: at(41).toISOString(), received_at: at(41.5).toISOString() });
    expect(all.json.data[1].recorded_at).toBe(at(12).toISOString()); // the newest, not the old one
    expect((await get(`/internal/locations/latest-by-vehicle?company_id=${company}&vehicle_ids=${v2}`)).json.data.length).toBe(1);
    expect((await get(`/internal/locations/latest-by-vehicle?company_id=${company}&vehicle_ids=${vOther}`)).json.data).toEqual([]); // not this company's vehicle
    expect((await get(`/internal/locations/latest-by-vehicle?company_id=${other}`)).json.data.map((p: any) => p.vehicle_id)).toEqual([String(vOther)]);
    expect((await get(`/internal/locations/latest-by-vehicle?company_id=${company}&vehicle_ids=1,x`)).status).toBe(422);
  });

  test("distance, speeds, gaps, abnormal and late points over a window", async () => {
    const r = await get(`/internal/stats/vehicles?company_id=${company}&from=${iso(at(-60))}&to=${iso(at(120))}`);
    expect(r.status).toBe(200);
    const [a, b] = r.json.data;
    expect(a.vehicle_id).toBe(String(v1));
    expect(a.points).toBe(6);
    // two real moves of 0.01 degree of latitude (about 1.112 km each); the teleport and the (0,0) jumps are left out
    expect(a.distance_km).toBeGreaterThan(2.2); expect(a.distance_km).toBeLessThan(2.25);
    expect(a.avg_speed_kmh).toBe(55); expect(a.max_speed_kmh).toBe(70);
    expect(a.gaps).toBe(2);                                  // 20 min and 14 min without a point
    expect(a.null_island).toBe(1); expect(a.impossible_speed).toBe(3); expect(a.anomalies).toBe(4);
    expect(a.late_points).toBe(1);
    expect(a.first_recorded_at).toBe(at(0).toISOString()); expect(a.last_recorded_at).toBe(at(41).toISOString()); expect(a.last_received_at).toBe(at(41.5).toISOString());
    expect(b.vehicle_id).toBe(String(v2));
    expect(b.points).toBe(2);                                // the point 4000 minutes ago is outside the window
    expect(b.distance_km).toBeGreaterThan(2.1); expect(b.distance_km).toBeLessThan(2.2);
    expect(b.gaps).toBe(0); expect(b.anomalies).toBe(0); expect(b.late_points).toBe(0);
  });

  test("the window decides which points count; a vehicle filter and the company are respected", async () => {
    const narrow = await get(`/internal/stats/vehicles?company_id=${company}&from=${iso(at(-60))}&to=${iso(at(6))}`);
    expect(narrow.json.data.map((x: any) => [x.vehicle_id, x.points])).toEqual([[String(v1), 2]]);
    const wide = await get(`/internal/stats/vehicles?company_id=${company}&from=${iso(at(-5000))}&to=${iso(at(120))}&vehicle_ids=${v2}`);
    expect(wide.json.data.length).toBe(1); expect(wide.json.data[0].points).toBe(3); // now the old point counts too
    expect(wide.json.data[0].gaps).toBe(1);                                          // ... and the long silence before it
    expect((await get(`/internal/stats/vehicles?company_id=${other}&from=${iso(at(-60))}&to=${iso(at(120))}`)).json.data.map((x: any) => x.vehicle_id)).toEqual([String(vOther)]);
    expect((await get(`/internal/stats/vehicles?company_id=${company}&from=${iso(at(-60 * 24 * 40))}&to=${iso(at(120))}`)).status).toBe(422); // longer than 31 days
    expect((await get(`/internal/stats/vehicles?company_id=${company}&from=${iso(at(120))}&to=${iso(at(-60))}`)).status).toBe(422);        // backwards
    expect((await get(`/internal/stats/vehicles?company_id=${company}&from=nope&to=${iso(at(1))}`)).status).toBe(422);
  });
});
