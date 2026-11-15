import { internalToken, required } from "@vayro/service-kit";

// Only the database and internal token are needed to load the app; upstream URLs are read by the HTTP adapters
// (src/adapters) so tests can inject fakes without configuring them.
export const config = { databaseUrl: required("DATABASE_URL"), internalToken: internalToken() };
