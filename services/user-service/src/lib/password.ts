// Passwords: Bun's built-in argon2id. Only user-service ever sees a password or its hash.
export const hashPassword = (password: string) => Bun.password.hash(password);
export const verifyPassword = (password: string, hash: string) => Bun.password.verify(password, hash);

// Verified against when the email is unknown, so unknown emails cost the same time as wrong passwords.
export const DUMMY_HASH = await Bun.password.hash("dummy-password-for-timing");
