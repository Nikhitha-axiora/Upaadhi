import { jwtVerify, SignJWT } from "jose";
import type { AuthClaims } from "./index.js";

const encoder = new TextEncoder();

function getJwtSecret() {
  return encoder.encode(process.env.JWT_SECRET ?? "local-development-secret-change-me");
}

export async function signAccessToken(claims: AuthClaims) {
  const ttl = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);

  return new SignJWT({ phone: claims.phone, roles: claims.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<AuthClaims> {
  const result = await jwtVerify(token, getJwtSecret());
  const roles = Array.isArray(result.payload.roles) ? result.payload.roles.map(String) : [];
  const phone = typeof result.payload.phone === "string" ? result.payload.phone : "";

  if (!result.payload.sub || !phone) {
    throw new Error("AUTH_TOKEN_INVALID");
  }

  return {
    userId: result.payload.sub,
    phone,
    roles
  };
}

