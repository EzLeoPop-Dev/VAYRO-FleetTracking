import { Elysia } from "elysia";
import { routeRoutes } from "./routes/routes";

export const app = new Elysia()
  .get("/", () => ({ service: "route-history-service", status: "ok" })) // Docker health check
  .use(routeRoutes);
