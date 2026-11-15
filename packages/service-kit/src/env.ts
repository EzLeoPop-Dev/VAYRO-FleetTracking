export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export function integer(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return value;
}

// Shared secret for service-to-service calls on /internal/*. The gateway never forwards those paths.
export function internalToken(): string {
  const token = required("INTERNAL_API_TOKEN");
  if (token.length < 32) throw new Error("INTERNAL_API_TOKEN must be at least 32 characters");
  return token;
}
