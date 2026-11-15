import { authResolver, createAuthed, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

// Use in routes: `.use(authed("company_admin", "dispatcher"))` then read `me` (id, role, company_id) in the handler.
export const authed = createAuthed(authResolver(internalClient(config.authServiceUrl, config.internalToken)));
