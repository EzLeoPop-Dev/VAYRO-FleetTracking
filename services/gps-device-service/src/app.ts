import { Elysia } from "elysia";
import { httpUserResolver, type ResolveUser } from "./adapters/auth-service";
import { httpVehicleDirectory, type VehicleDirectory } from "./adapters/vehicle-directory";
import { deviceRoutes } from "./routes/devices";
import { internalRoutes } from "./routes/internal";

// Every outside dependency can be replaced (tests pass fakes); by default they call the real services over HTTP.
export interface DeviceOptions {
  resolveUser?: ResolveUser;
  vehicles?: VehicleDirectory;
}

export function createDeviceApp(options: DeviceOptions = {}) {
  const resolveUser = options.resolveUser ?? httpUserResolver();
  const vehicles = options.vehicles ?? httpVehicleDirectory();
  return new Elysia({ normalize: false })
    .get("/", () => ({ service: "gps-device-service", status: "ok" })) // public: Docker health check
    .use(deviceRoutes({ resolveUser, vehicles }))
    .use(internalRoutes);
}
