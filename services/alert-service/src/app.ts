import { Elysia } from "elysia";

// TODO(team): add this module's routes here. The endpoints and the data it needs are listed in README.md.
export const app = new Elysia().get("/", () => ({ service: "alert-service", status: "ok" })); // Docker health check
