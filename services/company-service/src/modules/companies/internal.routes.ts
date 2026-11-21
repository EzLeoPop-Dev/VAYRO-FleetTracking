import { ApiError, http, idSchema, internalGuard, ok, parseId } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { config } from "../../config/env";
import * as service from "./companies.service";

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  .get("/stats/companies", async () => ok(await service.stats()))
  .get("/companies/:id", async ({ params }) => {
    const company = await service.getWorkspace(parseId(params.id));
    if (!company) throw new ApiError(404, "NOT_FOUND", "Company not found");
    return ok(company);
  }, { params: t.Object({ id: idSchema }) });
