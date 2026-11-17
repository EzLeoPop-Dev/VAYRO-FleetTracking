import { createAuthed } from "@vayro/service-kit";
import { Elysia } from "elysia";
import { httpUserResolver, type ResolveUser } from "./adapters/auth-service";
import { httpSources, type Sources } from "./adapters/sources";
import { dashboardRoutes } from "./routes/dashboard";
import { reportRoutes } from "./routes/reports";

// Every outside dependency can be replaced (tests pass fakes); by default they call the real services over HTTP.
export interface ReportingOptions {
  sources?: Sources;
  resolveUser?: ResolveUser;
  clock?: () => Date;
}

export function createReportingApp(options: ReportingOptions = {}) {
  const deps = {
    sources: options.sources ?? httpSources(),
    authed: createAuthed(options.resolveUser ?? httpUserResolver()),
    clock: options.clock ?? (() => new Date()),
  };
  return new Elysia()
    .get("/", () => ({ service: "reporting-service", status: "ok" })) // public: Docker health check
    .use(dashboardRoutes(deps))
    .use(reportRoutes(deps));
}
