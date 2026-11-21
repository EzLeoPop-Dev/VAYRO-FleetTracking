import { Elysia } from "elysia";
import { internalRoutes } from "./modules/internal/internal.routes";

// TODO(team): add this module's public routes here. The endpoints and the data it needs are listed in README.md.
// Today only the read-only /internal API for reporting-service exists.
export const app = new Elysia()
  .get("/", () => ({ service: "alert-service", status: "ok" })) // Docker health check
  .use(internalRoutes);
