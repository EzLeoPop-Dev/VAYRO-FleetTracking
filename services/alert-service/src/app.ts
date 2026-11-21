import { Elysia } from "elysia";
import { alertRoutes } from "./modules/alerts/alerts.routes";
import { geofenceRoutes } from "./modules/geofences/geofences.routes";
import { internalRoutes } from "./modules/internal/internal.routes";
import { ruleRoutes } from "./modules/rules/rules.routes";
import { systemLogs } from "./system-logs";

export const app = new Elysia()
  .get("/", () => ({ service: "alert-service", status: "ok" })) // Docker health check
  .use(ruleRoutes)
  .use(geofenceRoutes)
  .use(alertRoutes)
  .use(internalRoutes)
  .use(systemLogs);
