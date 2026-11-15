import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ApiError } from "@vayro/service-kit";

// Provider credentials are stored encrypted in gps_devices.credentials_encrypted: AES-256-GCM, key from
// CREDENTIALS_ENCRYPTION_KEY (base64 of 32 random bytes: `openssl rand -base64 32`).
// Stored text is "v1:<iv>:<auth tag>:<ciphertext>" (base64). The "v1" prefix lets a later key or format coexist.
// The key is read when a credential is saved, so a service without it still runs; only saving credentials fails.

const VERSION = "v1";

export function keyFromEnv(raw = process.env.CREDENTIALS_ENCRYPTION_KEY): Buffer {
  const key = raw ? Buffer.from(raw, "base64") : null;
  if (!key || key.length !== 32) throw new ApiError(503, "CREDENTIALS_NOT_CONFIGURED", "Encrypted credential storage is not configured on this server");
  return key;
}

export function encryptCredentials(value: Record<string, unknown>, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

// For a future provider adapter. Throws if the key is wrong or the stored text was changed (GCM authenticates it).
export function decryptCredentials(stored: string, key: Buffer): Record<string, unknown> {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unsupported credential format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8"));
}
