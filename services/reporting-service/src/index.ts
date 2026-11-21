import { createReportingApp } from "./app";

const app = createReportingApp().listen({ hostname: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
console.log(`reporting-service listening on ${app.server?.hostname}:${app.server?.port}`);
