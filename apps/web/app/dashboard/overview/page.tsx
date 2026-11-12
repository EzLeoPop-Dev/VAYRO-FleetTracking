import Link from "next/link";
import { demoFleet, directorySurface, statusLabels } from "../admin-directory";
import DashboardWindow from "../dashboard-window";
import {
  vehicleCategoryLabels,
  type VehicleCategory,
  type VehicleStatus,
  type VehicleUsage,
} from "../fleet-demo";

export const metadata = { title: "ภาพรวม | VAYRO" };

const usageRows = [
  { key: "working", label: "ปฏิบัติงาน", color: "bg-emerald-500" },
  { key: "ready", label: "พร้อมใช้งาน", color: "bg-sky-500" },
  { key: "unused", label: "ไม่ได้ใช้งาน", color: "bg-amber-400" },
  { key: "unknown", label: "ยังไม่ระบุสถานะ", color: "bg-slate-400" },
] as const;

const gpsRows = [
  { key: "moving", color: "bg-emerald-500" },
  { key: "parked", color: "bg-amber-400" },
  { key: "offline", color: "bg-slate-400" },
] as const;

const countUnit = "ml-1 text-xs font-normal text-[color:var(--fleet-muted)]";
const textLink =
  "inline-flex min-h-9 items-center rounded-md text-sm font-semibold text-[color:var(--fleet-accent)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fleet-focus)]";

export default function OverviewPage() {
  const usageCounts: Record<VehicleUsage, number> = {
    working: 0,
    ready: 0,
    unused: 0,
    unknown: 0,
  };
  const gpsCounts: Record<VehicleStatus, number> = {
    moving: 0,
    parked: 0,
    offline: 0,
  };
  const categoryCounts: Record<VehicleCategory, number> = {
    truck: 0,
    car: 0,
    motorcycle: 0,
  };
  const drivers = new Set<string>();

  for (const vehicle of demoFleet) {
    usageCounts[vehicle.usage] += 1;
    gpsCounts[vehicle.status] += 1;
    categoryCounts[vehicle.category] += 1;
    const driver = vehicle.driver.trim();
    if (driver) drivers.add(driver);
  }

  return (
    <DashboardWindow title="ภาพรวมการขนส่ง">
      <div
        role="region"
        aria-label="สรุปข้อมูลจำลอง"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[var(--fleet-page)] p-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--fleet-focus)] sm:p-4"
      >
        <p className="mb-3 text-sm text-[color:var(--fleet-muted)]">
          สรุปพนักงานขับรถ รถ และสถานะของฟลีตจากข้อมูลจำลอง
        </p>
        <dl
          className={`${directorySurface} grid grid-cols-2 divide-x divide-[var(--fleet-line)]`}
        >
          <div className="p-3 sm:px-4">
            <dt className="text-sm font-semibold text-[color:var(--fleet-muted)]">
              พนักงานขับรถ
            </dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums">
              {drivers.size}
              <span className={countUnit}>คน</span>
            </dd>
            <dd>
              <Link href="/dashboard/drivers" className={textLink}>
                ดูรายชื่อคนขับ
              </Link>
            </dd>
          </div>
          <div className="p-3 sm:px-4">
            <dt className="text-sm font-semibold text-[color:var(--fleet-muted)]">
              รถทั้งหมด
            </dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums">
              {demoFleet.length}
              <span className={countUnit}>คัน</span>
            </dd>
            <dd>
              <Link href="/dashboard/vehicles" className={textLink}>
                ดูทะเบียนรถ
              </Link>
            </dd>
          </div>
        </dl>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1.15fr_1fr]">
          <section
            aria-labelledby="fleet-usage-heading"
            className={`${directorySurface} p-3 sm:px-4`}
          >
            <h2 id="fleet-usage-heading" className="text-base font-bold">
              การใช้งานรถ
            </h2>
            <p className="mt-1 text-sm text-[color:var(--fleet-muted)]">
              สถานะจากข้อมูลการจัดรถในเดโม
            </p>
            {demoFleet.length > 0 && (
              <div
                aria-hidden="true"
                className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-full bg-[var(--fleet-quiet)]"
              >
                {usageRows
                  .filter(({ key }) => usageCounts[key] > 0)
                  .map(({ key, color }) => (
                    <span
                      key={key}
                      className={color}
                      style={{ flexGrow: usageCounts[key] }}
                    />
                  ))}
              </div>
            )}
            <dl className="mt-3 divide-y divide-[var(--fleet-line)]">
              {usageRows.map(({ key, label, color }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <dt className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 rounded-full ${color}`}
                    />
                    {label}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {usageCounts[key]}
                    <span className={countUnit}>คัน</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            aria-labelledby="fleet-gps-heading"
            className={`${directorySurface} p-3 sm:px-4`}
          >
            <h2 id="fleet-gps-heading" className="text-base font-bold">
              สถานะบนแผนที่
            </h2>
            <p className="mt-1 text-sm text-[color:var(--fleet-muted)]">
              สถานะจากสัญญาณ GPS จำลอง
            </p>
            <dl className="mt-3 divide-y divide-[var(--fleet-line)]">
              {gpsRows.map(({ key, color }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <dt className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 rounded-full ${color}`}
                    />
                    {statusLabels[key]}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {gpsCounts[key]}
                    <span className={countUnit}>คัน</span>
                  </dd>
                </div>
              ))}
            </dl>
            <Link href="/dashboard" className={`${textLink} mt-1`}>
              เปิดแผนที่ติดตามรถ
            </Link>
          </section>
        </div>

        <section
          aria-labelledby="fleet-types-heading"
          className={`${directorySurface} mt-3 p-3 sm:px-4`}
        >
          <h2 id="fleet-types-heading" className="text-base font-bold">
            จำนวนรถตามประเภท
          </h2>
          <dl className="mt-3 grid grid-cols-3 divide-x divide-[var(--fleet-line)]">
            {(Object.keys(categoryCounts) as VehicleCategory[]).map(
              (category) => (
                <div
                  key={category}
                  className="px-3 first:pl-0 last:pr-0 sm:px-5"
                >
                  <dt className="text-xs text-[color:var(--fleet-muted)] sm:text-sm">
                    {vehicleCategoryLabels[category]}
                  </dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums">
                    {categoryCounts[category]}
                    <span className={countUnit}>คัน</span>
                  </dd>
                </div>
              ),
            )}
          </dl>
        </section>
      </div>
    </DashboardWindow>
  );
}
