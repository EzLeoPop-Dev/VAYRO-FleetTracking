import type { Db, Prisma } from "../lib/prisma";

// The only place that talks to gps_locations.
export type LocationRow = Prisma.GpsLocationGetPayload<object>;

export const exists = async (db: Db, deviceId: bigint, externalRecordId: string) =>
  (await db.gpsLocation.findUnique({ where: { gps_device_id_external_record_id: { gps_device_id: deviceId, external_record_id: externalRecordId } }, select: { gps_location_id: true } })) !== null;

export const insert = (db: Db, data: Prisma.GpsLocationUncheckedCreateInput) => db.gpsLocation.create({ data });

// Newest first; the caller reverses it for chronological output.
export const history = (db: Db, where: Prisma.GpsLocationWhereInput, take: number) =>
  db.gpsLocation.findMany({ where, orderBy: [{ recorded_at: "desc" }, { gps_location_id: "desc" }], take });

// The stored point just before `before` in recorded_at order (for abnormal-data checks).
export const previousOf = (db: Db, where: Prisma.GpsLocationWhereInput, before: Date) =>
  db.gpsLocation.findFirst({ where: { ...where, recorded_at: { lt: before } }, orderBy: [{ recorded_at: "desc" }, { gps_location_id: "desc" }] });

export const latest = (db: Db, where: Prisma.GpsLocationWhereInput) =>
  db.gpsLocation.findFirst({ where, orderBy: [{ recorded_at: "desc" }, { gps_location_id: "desc" }] });
