import { createCompanyApp } from "./app";

const app = createCompanyApp().listen({ hostname: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 3000) });
console.log(`company-service listening on ${app.server?.hostname}:${app.server?.port}`);
