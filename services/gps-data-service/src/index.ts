import { createGpsDataApp } from "./app";

const app = createGpsDataApp().listen({ hostname: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
console.log(`gps-data-service listening on ${app.server?.hostname}:${app.server?.port}`);
