import type { Db, Prisma } from "../lib/prisma";

export const find = (db: Db, vehicleId: bigint) => db.vehicleSignalState.findUnique({ where: { vehicle_id: vehicleId } });

export function save(db: Db, data: Prisma.VehicleSignalStateUncheckedCreateInput) {
  const { vehicle_id: _id, ...changes } = data;
  return db.vehicleSignalState.upsert({ where: { vehicle_id: data.vehicle_id }, create: data, update: changes });
}

// Vehicles that went quiet and were not yet reported, for one company's "GPS offline" threshold.
export const staleFor = (db: Db, companyId: bigint, cutoff: Date, floor: Date) =>
  db.vehicleSignalState.findMany({ where: { company_id: companyId, offline_alerted: false, last_received_at: { lt: cutoff, gt: floor } }, take: 200, orderBy: { last_received_at: "asc" } });

export const markOfflineAlerted = (db: Db, vehicleId: bigint) => db.vehicleSignalState.update({ where: { vehicle_id: vehicleId }, data: { offline_alerted: true } });

export const pause = (db: Db, companyId: bigint, vehicleId: bigint) =>
  db.vehicleSignalState.updateMany({ where: { vehicle_id: vehicleId, company_id: companyId }, data: { offline_alerted: true } });
