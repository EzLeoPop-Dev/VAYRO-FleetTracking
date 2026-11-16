import { ApiError, authResolver, internalClient, internalToken, required, type Caller, type Identity } from "@vayro/service-kit";
import type { TokenIdentity } from "./device-tokens";
import type { FleetDirectory } from "./fleet-directory";

export type ResolveUser = (authorization: string | null | undefined) => Promise<Caller>;

// Production way to check a human's bearer token: ask auth-service.
export const httpUserResolver = (): ResolveUser => authResolver(internalClient(required("AUTH_SERVICE_URL"), internalToken()));

// Who is calling: a registered GPS device credential, or a signed-in user.
export function createIdentityResolver(deps: { tokens: ReadonlyMap<string, TokenIdentity>; resolveUser: ResolveUser; fleet: FleetDirectory }) {
  return async function resolve(authorization: string | null | undefined): Promise<Identity> {
    const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
    const device = token ? deps.tokens.get(token) : undefined;
    if (device) {
      if ((await deps.fleet.workspaceStatus(device.company_id)) !== "active") throw new ApiError(403, "WORKSPACE_NOT_ACTIVE", "Device workspace is not active");
      return device;
    }
    const user = await deps.resolveUser(authorization);
    return { role: user.role, company_id: user.company_id, user_id: user.user_id };
  };
}
