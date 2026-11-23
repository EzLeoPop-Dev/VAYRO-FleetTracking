import { authResolver, internalClient, internalToken, required, type Caller } from "@vayro/service-kit";

export type ResolveUser = (authorization: string | null | undefined) => Promise<Caller>;

// Production way to check a bearer token: ask auth-service (signature, live session, current user/workspace status).
export const httpUserResolver = (): ResolveUser => authResolver(internalClient(required("AUTH_SERVICE_URL"), internalToken()));
