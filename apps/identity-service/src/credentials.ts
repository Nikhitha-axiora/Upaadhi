import crypto from "node:crypto";

/**
 * Password credential store, kept separate from the user profile repository so
 * secrets never mix with public profile data.
 *
 * Hashing uses scrypt (a memory-hard KDF built into Node) with a per-password
 * random salt; only `scrypt$salt$hash` is stored. In production this maps onto
 * Argon2id + an encrypted credentials table; the surface below stays the same.
 */

const SCRYPT_KEYLEN = 64;
const store = new Map<string, string>();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function check(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export const credentials = {
  set(userId: string, password: string): void {
    store.set(userId, hashPassword(password));
  },
  has(userId: string): boolean {
    return store.has(userId);
  },
  verify(userId: string, password: string): boolean {
    const stored = store.get(userId);
    return stored ? check(password, stored) : false;
  }
};
