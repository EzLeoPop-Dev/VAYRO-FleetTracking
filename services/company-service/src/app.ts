import { Elysia } from "elysia";
import { companyRoutes } from "./modules/companies/companies.routes";
import { internalRoutes } from "./modules/companies/internal.routes";

export const app = new Elysia()
  .get("/", () => ({ service: "company-service", status: "ok" })) // Docker health check
  .use(companyRoutes)
  .use(internalRoutes);
