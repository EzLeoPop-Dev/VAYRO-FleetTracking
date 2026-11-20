import { Elysia } from "elysia";
import { internalRoutes } from "./modules/internal/internal.routes";
import { driverRoutes, jobRoutes } from "./modules/jobs/jobs.routes";
import { systemLogs } from "./system-logs";

export const app = new Elysia()
  .get("/", () => ({ service: "transport-service", status: "ok" })) // Docker health check
  .use(jobRoutes)
  .use(driverRoutes)
  .use(internalRoutes)
  .use(systemLogs);
