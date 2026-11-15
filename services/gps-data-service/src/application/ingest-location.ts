import { ApiError, parseId, requireRole, type Identity } from "@vayro/service-kit";
import type { DeviceDirectory } from "../adapters/device-directory";
import type { EventPublisher } from "../adapters/event-publisher";
import type { FleetDirectory } from "../adapters/fleet-directory";
import { anomaliesOf, assertDriverMayReport, assertNotInFuture } from "../domain/gps";
import * as locations from "../infrastructure/location.repository";
import { prisma } from "../lib/prisma";
import { toGpsLocation } from "../schemas/gps.schema";

export interface IngestCtx {
  identity: Identity;
  fleet: FleetDirectory;
  devices: DeviceDirectory;
  events: EventPublisher;
}

export interface IngestInput {
  device_code: string;
  external_record_id?: string | null;
  recorded_at: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number | null;
  direction_degree?: number | null;
  accuracy_meters?: number | null;
}

const duplicate = () => new ApiError(409, "DUPLICATE_RECORD", "external_record_id already exists for this device");

// Accepts one position from a GPS device credential or from an assigned driver's phone.
export async function ingestLocation({ identity, fleet, devices, events }: IngestCtx, body: IngestInput) {
  requireRole(identity, "gps_device", "driver");
  const deviceCode = body.device_code.trim();
  if (identity.role === "gps_device" && identity.device_code !== deviceCode) throw new ApiError(403, "FORBIDDEN", "Device code does not match credential");
  const recordedAt = new Date(body.recorded_at);
  assertNotInFuture(recordedAt);
  const companyId = identity.company_id!; // gps_device credentials and active drivers always have a company

  const device = await devices.byCode(companyId, deviceCode);
  if (!device) throw new ApiError(403, "FORBIDDEN", "Device is not registered for this company");
  if (device.disabled) throw new ApiError(403, "DEVICE_DISABLED", "GPS connection is disabled");

  if (identity.role === "driver") {
    const vehicle = await fleet.getVehicle(companyId, device.vehicle_id);
    if (!vehicle) throw new ApiError(404, "NOT_FOUND", "Vehicle not found in this company");
    assertDriverMayReport({
      sourceType: device.source_type,
      driverId: identity.user_id!,
      vehicle,
      hasActiveJob: await fleet.hasActiveJob(companyId, vehicle.vehicle_id, identity.user_id!),
    });
  }

  const deviceId = parseId(device.gps_device_id);
  const externalId = body.external_record_id ?? null;
  if (externalId !== null && (await locations.exists(prisma, deviceId, externalId))) throw duplicate();
  // Abnormal-data check against the stored point just before this one in time. The point is stored either way and flagged.
  const vehicleKey = { vehicle_id: parseId(device.vehicle_id), company_id: parseId(companyId) };
  const previous = await locations.previousOf(prisma, vehicleKey, recordedAt);
  let point;
  try {
    point = await locations.insert(prisma, {
      company_id: parseId(companyId),
      vehicle_id: parseId(device.vehicle_id),
      gps_device_id: deviceId,
      external_record_id: externalId,
      latitude: body.latitude,
      longitude: body.longitude,
      speed_kmh: body.speed_kmh ?? null,
      direction_degree: body.direction_degree ?? null,
      accuracy_meters: body.accuracy_meters ?? null,
      recorded_at: recordedAt,
    });
  } catch (err) {
    // Two copies of one record at the same moment: the unique index lets exactly one in.
    if ((err as { code?: string }).code === "P2002") throw duplicate();
    throw err;
  }

  // The point is already stored; a failed status update must not turn a stored point into an error.
  // The device status is derived from last_received_at, so the next point repairs it.
  await devices.markReceived(device.gps_device_id, point.received_at).catch((err) => console.error("device status update failed:", err instanceof Error ? err.message : "unknown error"));
  const stored = toGpsLocation(point, anomaliesOf({ latitude: body.latitude, longitude: body.longitude, recordedAt }, previous && { latitude: previous.latitude.toNumber(), longitude: previous.longitude.toNumber(), recordedAt: previous.recorded_at }));
  events.locationStored(stored);
  return stored;
}
