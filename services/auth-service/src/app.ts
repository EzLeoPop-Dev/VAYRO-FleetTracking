import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth/auth.routes";
import { internalRoutes } from "./modules/internal/internal.routes";

export const app = new Elysia()
  .get("/", () => ({ service: "auth-service", status: "ok" })) // Docker health check
  .use(authRoutes)
  .use(internalRoutes);
