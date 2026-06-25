import crypto from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { AuthClaims } from "./index.js";

const encoder = new TextEncoder();

function getJwtSecret() {
  return encoder.encode(process.env.JWT_SECRET ?? "local-development-secret-change-me");
}

export async function signAccessToken(claims: AuthClaims) {
  // Short-lived by design (NIST authenticator lifecycle): default 10 minutes.
  const ttl = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 600);

  const token = new SignJWT({ phone: claims.phone, roles: claims.roles, sid: claims.sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`);

  return token.sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<AuthClaims> {
  const result = await jwtVerify(token, getJwtSecret());
  const roles = Array.isArray(result.payload.roles) ? result.payload.roles.map(String) : [];
  const phone = typeof result.payload.phone === "string" ? result.payload.phone : "";
  const sessionId = typeof result.payload.sid === "string" ? result.payload.sid : undefined;

  if (!result.payload.sub || !phone) {
    throw new Error("AUTH_TOKEN_INVALID");
  }

  return {
    userId: result.payload.sub,
    phone,
    roles,
    sessionId
  };
}

/* ---- Refresh tokens (opaque, rotated, hashed at rest) -------------------- */

/** High-entropy opaque token handed to the client; only its hash is stored. */
export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** SHA-256 hash for constant-storage comparison of refresh tokens. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Stable device fingerprint from user-agent + a client-supplied device id. */
export function deviceFingerprint(deviceId: string | undefined, userAgent: string | undefined): string {
  return crypto
    .createHash("sha256")
    .update(`${deviceId ?? "unknown"}|${userAgent ?? "unknown"}`)
    .digest("hex")
    .slice(0, 16);
}
