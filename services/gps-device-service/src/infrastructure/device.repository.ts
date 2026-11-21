import { Prisma, type Db } from "../lib/prisma";

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

// Counts of devices by derived status, done by the database so it scales and never stops at a row limit.
// The rule is the one in domain/device.ts connectionStatus(): a disabled device is "disconnected"; otherwise a stored
// "error" stays "error"; otherwise "connected" only if it reported since `connectedSince`. (A test keeps the two in step.)
export const statusCounts = (db: Db, companyId: bigint | undefined, connectedSince: Date) =>
  db.$queryRaw<{ status: string; disabled: boolean; n: number }[]>(Prisma.sql`
    SELECT CASE WHEN coalesce(connection_config ->> 'disabled', '') = 'true' THEN 'disconnected'
                WHEN connection_status = 'error' THEN 'error'
                WHEN last_received_at IS NOT NULL AND last_received_at >= ${connectedSince} THEN 'connected'
                ELSE 'disconnected' END AS status,
           (coalesce(connection_config ->> 'disabled', '') = 'true') AS disabled,
           count(*)::int AS n
    FROM gps_devices
    WHERE TRUE ${companyId === undefined ? Prisma.empty : Prisma.sql`AND company_id = ${companyId}`}
    GROUP BY 1, 2`);
