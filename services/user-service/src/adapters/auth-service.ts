import { authResolver, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const auth = internalClient(config.authServiceUrl, config.internalToken);

// Validates a bearer token with auth-service (signature, live session, current user/workspace status).
export const resolveCaller = authResolver(auth);

// Ends every session of a user. Best effort: a deactivated user is already rejected by auth-service on every
// request and refresh, so a failure here only delays cleanup of the session rows.
export async function revokeSessions(userId: string) {
  try {
    const { status } = await auth("POST", "/internal/sessions/revoke", { body: { user_id: userId } });
    if (status !== 200) console.error(`session revoke for user ${userId} returned ${status}`);
  } catch (err) {
    console.error(`session revoke for user ${userId} failed:`, err instanceof Error ? err.message : "unknown error");
  }
}
