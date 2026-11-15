import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { config } from "../config/env";

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });

// A query surface shared by `prisma` and the `tx` handed out by prisma.$transaction.
export type Db = Prisma.TransactionClient;
export { Prisma };
