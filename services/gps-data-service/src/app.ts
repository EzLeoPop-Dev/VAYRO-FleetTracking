import { Elysia } from "elysia";
import { parseTokenConfig, type TokenIdentity } from "./adapters/device-tokens";
import { httpDeviceDirectory, type DeviceDirectory } from "./adapters/device-directory";
import { httpEventPublisher, type EventPublisher } from "./adapters/event-publisher";
import { httpFleetDirectory, type FleetDirectory } from "./adapters/fleet-directory";
import { createIdentityResolver, httpUserResolver, type ResolveUser } from "./adapters/identity";
import { internalRoutes } from "./routes/internal";
import { locationRoutes } from "./routes/locations";

export { parseTokenConfig, type TokenIdentity };

// Every outside dependency can be replaced (tests pass fakes); by default they call the real services over HTTP.
export interface GpsDataOptions {
  tokens?: ReadonlyMap<string, TokenIdentity>;
  resolveUser?: ResolveUser;
  fleet?: FleetDirectory;
  devices?: DeviceDirectory;
  events?: EventPublisher;
}

export function createGpsDataApp(options: GpsDataOptions = {}) {
  const tokens = options.tokens ?? parseTokenConfig(process.env.TRACKING_API_TOKENS);
  const fleet = options.fleet ?? httpFleetDirectory();
  const devices = options.devices ?? httpDeviceDirectory();
  const events = options.events ?? httpEventPublisher();
  const identity = createIdentityResolver({ tokens, resolveUser: options.resolveUser ?? httpUserResolver(), fleet });

  return new Elysia({ normalize: false })
    .get("/", () => ({ service: "gps-data-service", status: "ok" })) // public: Docker health check
    .use(locationRoutes({ identity, fleet, devices, events }))
    .use(internalRoutes);
}
