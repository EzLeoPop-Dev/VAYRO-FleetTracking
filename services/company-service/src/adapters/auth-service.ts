import { authResolver, internalClient, type Caller } from "@vayro/service-kit";
import { config } from "../config/env";

export type ResolveUser = (authorization: string | null | undefined) => Promise<Caller>;

// Production way to check a bearer token: ask auth-service (signature, live session, current user/workspace status).
// A function, so a test can pass a fake resolver instead.
export const httpUserResolver = (): ResolveUser => authResolver(internalClient(config.authServiceUrl, config.internalToken));
