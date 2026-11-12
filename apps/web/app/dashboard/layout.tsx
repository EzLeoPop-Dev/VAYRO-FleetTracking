import type { ReactNode } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import AdminShell from "./admin-shell";
import FleetDashboard from "./fleet-dashboard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AdminShell map={<FleetDashboard />}>{children}</AdminShell>;
}
