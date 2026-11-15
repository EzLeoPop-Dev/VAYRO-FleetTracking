import type { Db, Prisma } from "../lib/prisma";

// The only place that talks to gps_devices. credentials_encrypted is selected only so the API can say whether credentials
// exist (has_credentials); toGpsDevice() never copies it out, and it is never logged or audited.
export const DEVICE_SELECT = {
  gps_device_id: true,
  company_id: true,
  vehicle_id: true,
  device_code: true,
  source_type: true,
  provider_name: true,
  connection_config: true,
  credentials_encrypted: true,
  connection_status: true,
  last_received_at: true,
  created_at: true,
  updated_at: true,
} as const;

export type DeviceRow = Prisma.GpsDeviceGetPayload<{ select: typeof DEVICE_SELECT }>;

export const list = (db: Db, where: Prisma.GpsDeviceWhereInput, take: number, skip: number) =>
  db.gpsDevice.findMany({ where, select: DEVICE_SELECT, orderBy: { gps_device_id: "asc" }, take, skip });

export const findOne = (db: Db, where: Prisma.GpsDeviceWhereInput) => db.gpsDevice.findFirst({ where, select: DEVICE_SELECT });

// Serializes writers of one device (settings changes) so read-modify-write cannot interleave.
export const lock = (db: Db, id: bigint) => db.$queryRaw`SELECT gps_device_id FROM gps_devices WHERE gps_device_id = ${id} FOR UPDATE`;

export const create = (db: Db, data: Prisma.GpsDeviceUncheckedCreateInput) => db.gpsDevice.create({ data, select: DEVICE_SELECT });

export const update = (db: Db, id: bigint, data: Prisma.GpsDeviceUncheckedUpdateInput) =>
  db.gpsDevice.update({ where: { gps_device_id: id }, data, select: DEVICE_SELECT });
