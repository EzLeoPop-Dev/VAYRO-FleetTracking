import { Elysia } from "elysia";
import { internalRoutes } from "./modules/internal/internal.routes";

// Public transport-job CRUD is not built yet; today this service only answers other services' lookups.
export const app = new Elysia()
  .get("/", () => ({ service: "transport-service", status: "ok" })) // Docker health check
  .use(internalRoutes);
