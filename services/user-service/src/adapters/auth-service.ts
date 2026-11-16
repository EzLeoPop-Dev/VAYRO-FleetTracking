import { authResolver, internalClient } from "@vayro/service-kit";
import { config } from "../config/env";

const auth = internalClient(config.authServiceUrl, config.internalToken);

// Validates a bearer token with auth-service (signature, live session, current user/workspace status).
export const resolveCaller = authResolver(auth);

// Ends every session of a user. Tried again a few times (auth-service may be restarting) and says whether it worked,
// so the caller can refuse to go on when it matters. `call` and `delaysMs` are parameters so tests can fake them.
export async function revokeSessions(userId: string, call: typeof auth = auth, delaysMs: number[] = [200, 600]): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      const { status } = await call("POST", "/internal/sessions/revoke", { body: { user_id: userId } });
      if (status === 200) return true;
      console.error(`session revoke for user ${userId} returned ${status}`);
    } catch (err) {
      console.error(`session revoke for user ${userId} failed:`, err instanceof Error ? err.message : "unknown error");
    }
    if (attempt >= delaysMs.length) return false;
    await Bun.sleep(delaysMs[attempt]!);
  }
}
