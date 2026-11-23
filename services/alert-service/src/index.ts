import { app } from "./app";
import { startOfflineScanner } from "./application/offline-scan";
import { config } from "./config/env";

app.listen({ hostname: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
startOfflineScanner(config.offlineScanSeconds); // not started by app.ts, so importing the app in a test never starts a timer
console.log(`alert-service listening on ${app.server?.hostname}:${app.server?.port}`);
