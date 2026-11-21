import { Elysia } from "elysia";
import { integrationRoutes } from "./modules/integrations/integrations.routes";
import { internalRoutes } from "./modules/internal/internal.routes";
import { integrationLogRoutes, systemLogRoutes } from "./modules/activity/activity.routes";
import { systemLogs } from "./system-logs";

export const app = new Elysia()
  .get("/", () => ({ service: "integration-service", status: "ok" })) // Docker health check
  .use(integrationRoutes)
  .use(integrationLogRoutes)
  .use(systemLogRoutes)
  .use(internalRoutes)
  .use(systemLogs);
