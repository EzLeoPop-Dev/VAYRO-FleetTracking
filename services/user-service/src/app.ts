import { Elysia } from "elysia";
import { internalRoutes } from "./modules/internal/internal.routes";
import { userRoutes } from "./modules/users/users.routes";

export const app = new Elysia()
  .get("/", () => ({ service: "user-service", status: "ok" })) // Docker health check
  .use(userRoutes)
  .use(internalRoutes);
