import { demoFleet, statusLabels } from "../admin-directory";
import VehicleWindow from "../vehicle-window";

export const metadata = { title: "จัดการรถ | VAYRO" };

export default function VehiclesPage() {
  const vehicles = demoFleet.map(({ id, plate, name, driver, kind, category, status }) => (
    { id, plate, name, driver, kind, category, status }
  ));
  return <VehicleWindow vehicles={vehicles} statusLabels={statusLabels} />;
}
