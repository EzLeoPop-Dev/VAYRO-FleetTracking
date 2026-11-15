import { internalToken, required } from "@vayro/service-kit";

export const config = { authServiceUrl: required("AUTH_SERVICE_URL"), internalToken: internalToken() };
