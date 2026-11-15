import { createHash, randomBytes } from "node:crypto";

// Refresh tokens are 256-bit random, so a plain SHA-256 is enough for storage.
export const newRefreshToken = () => randomBytes(32).toString("base64url");
export const hashRefreshToken = (token: string) => createHash("sha256").update(token).digest("hex");
