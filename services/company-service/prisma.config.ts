import { defineConfig } from "prisma/config";

// `prisma generate` needs no connection, so the URL falls back to a placeholder (build step has no database).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://unused:unused@localhost:5432/unused" },
});
