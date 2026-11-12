"use client";

import { useState } from "react";
import DashboardWindow from "./dashboard-window";
import {
  vehicleCategoryLabels,
  type FleetVehicle,
  type VehicleStatus,
} from "./fleet-demo";

type VehicleRow = Pick<
  FleetVehicle,
  "id" | "plate" | "name" | "driver" | "kind" | "category" | "status"
>;

const statusColor: Record<VehicleStatus, string> = {
  moving: "bg-emerald-500",
  parked: "bg-amber-500",
  offline: "bg-slate-400",
};

const focusRing =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--fleet-focus)]";

export default function VehicleWindow({
  vehicles,
  statusLabels,
}: {
  vehicles: VehicleRow[];
  statusLabels: Record<VehicleStatus, string>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = [...new Set(vehicles.map((vehicle) => vehicle.category))];
  const search = query.trim().toLowerCase();
  const results = vehicles.filter(
    (vehicle) =>
      (category === "all" || vehicle.category === category) &&
      [vehicle.plate, vehicle.name, vehicle.driver].some((value) =>
        value.toLowerCase().includes(search),
      ),
  );

  return (
    <DashboardWindow title="จัดการรถ">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--fleet-line)] p-3 sm:p-4">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">ค้นหารถหรือคนขับ</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--fleet-muted)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="m15 15 4 4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาทะเบียนหรือคนขับ"
            className={`h-10 w-full min-w-0 rounded-xl soft-inset border border-[var(--fleet-line)] bg-[var(--fleet-quiet)] pl-9 pr-2 text-base placeholder:text-[color:var(--fleet-muted)] sm:text-sm ${focusRing}`}
          />
        </label>
        <select
          aria-label="กรองตามประเภทรถ"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={`h-10 max-w-[45%] rounded-xl soft-control border border-[var(--fleet-line)] bg-[var(--fleet-surface)] px-2 text-base sm:px-3 sm:text-sm ${focusRing}`}
        >
          <option value="all">ทุกประเภท</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {vehicleCategoryLabels[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 bg-[var(--fleet-quiet)] text-xs text-[color:var(--fleet-muted)]">
            <tr>
              <th scope="col" className="px-3 py-2.5 sm:px-5">
                ทะเบียน
              </th>
              <th scope="col" className="hidden px-3 py-2.5 sm:table-cell">
                ประเภท
              </th>
              <th scope="col" className="hidden px-3 py-2.5 sm:table-cell">
                คนขับ
              </th>
              <th scope="col" className="px-3 py-2.5 sm:px-5">
                สถานะ
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((vehicle) => (
              <tr
                key={vehicle.id}
                className="hover:bg-[var(--fleet-quiet)] [&>td]:border-b [&>td]:border-[var(--fleet-line)]"
              >
                <td className="px-3 py-2.5 sm:px-5">
                  <p className="font-semibold tabular-nums">{vehicle.plate}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--fleet-muted)] sm:hidden">
                    {vehicle.kind} · {vehicle.driver}
                  </p>
                  <p className="mt-0.5 hidden text-xs text-[color:var(--fleet-muted)] sm:block">
                    {vehicle.name}
                  </p>
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  {vehicle.kind}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  {vehicle.driver}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap sm:px-5">
                  <span
                    className={`mr-2 inline-block size-2 rounded-full align-middle ${statusColor[vehicle.status]}`}
                  />
                  <span className="text-xs sm:text-sm">
                    {statusLabels[vehicle.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-[color:var(--fleet-muted)]">
            ไม่พบรถที่ตรงกับการค้นหาหรือตัวกรอง
          </p>
        )}
      </div>

      <footer className="flex shrink-0 justify-between gap-3 border-t border-[var(--fleet-line)] bg-[var(--fleet-quiet)] px-3 py-2.5 text-xs text-[color:var(--fleet-muted)] sm:px-5">
        <span aria-live="polite" className="tabular-nums">
          {results.length} จาก {vehicles.length} คัน
        </span>
        <span>ข้อมูลจำลอง</span>
      </footer>
    </DashboardWindow>
  );
}
