import { ApiError, http, idSchema, internalGuard, ok, parseId } from "@vayro/service-kit";
import { Elysia, t } from "elysia";
import { config } from "../../config/env";
import { prisma } from "../../lib/prisma";

// Service-to-service API. Not reachable through the gateway; every call needs the internal token.
export const internalRoutes = new Elysia({ prefix: "/internal" }).use(http).use(internalGuard(config.internalToken))
  // With company_id, the vehicle must belong to that company or it is "not found" (never reveals other companies' vehicles).
  // Without it, any company's vehicle matches: only for Platform Admin callers.
  .get("/vehicles/:id", async ({ params, query }) => {
    const vehicle = await prisma.vehicle.findFirst({
      where: { vehicle_id: parseId(params.id), ...(query.company_id ? { company_id: parseId(query.company_id) } : {}) },
      select: { vehicle_id: true, company_id: true, vehicle_status: true, current_driver_id: true, vehicle_code: true, license_plate: true, vehicle_type: { select: { type_name: true } } },
    });
    if (!vehicle) throw new ApiError(404, "NOT_FOUND", "Vehicle not found");
    return ok({
      vehicle_id: String(vehicle.vehicle_id),
      company_id: String(vehicle.company_id),
      vehicle_status: vehicle.vehicle_status,
      current_driver_id: vehicle.current_driver_id === null ? null : String(vehicle.current_driver_id),
      vehicle_code: vehicle.vehicle_code,
      license_plate: vehicle.license_plate,
      vehicle_type_name: vehicle.vehicle_type?.type_name ?? null,
    });
  }, { params: t.Object({ id: idSchema }), query: t.Object({ company_id: t.Optional(idSchema) }) });
