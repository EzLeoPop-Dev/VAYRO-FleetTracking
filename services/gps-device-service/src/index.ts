import { createDeviceApp } from "./app";

const app = createDeviceApp().listen({ hostname: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
console.log(`gps-device-service listening on ${app.server?.hostname}:${app.server?.port}`);
