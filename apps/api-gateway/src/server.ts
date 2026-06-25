import "dotenv/config";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ApiResponse, fail, ok, VerificationRecord } from "@upaadhi/shared";
import { verifyAccessToken } from "@upaadhi/shared/auth";
import { hasAnyRole, isPrivileged, PRIVILEGED_ROLES } from "@upaadhi/shared/security";
import type { AuthClaims } from "@upaadhi/shared";

const isProduction = process.env.NODE_ENV === "production";

// Secret-management guard: never boot production on default/weak secrets.
const WEAK_SECRETS: Record<string, string> = {
  JWT_SECRET: "local-development-secret-change-me",
  OTP_PEPPER: "local-otp-pepper"
};
if (isProduction) {
  for (const [name, weak] of Object.entries(WEAK_SECRETS)) {
    const value = process.env[name];
    if (!value || value === weak) {
      // Fail closed rather than run with a guessable signing/peppering secret.
      throw new Error(`Refusing to start: ${name} must be set to a strong value in production.`);
    }
  }
}

const port = Number(process.env.PORT ?? 4000);
// trustProxy lets us read the real client IP from X-Forwarded-For behind a proxy.
// bodyLimit is raised to carry downscaled verification images.
const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 16 * 1024 * 1024 });

/* ---- Security headers (defence-in-depth on every response) --------------- */
app.addHook("onSend", async (_request, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("Cross-Origin-Resource-Policy", "same-site");
  reply.header("Permissions-Policy", "geolocation=(self), camera=(self), microphone=()");
  reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  reply.removeHeader("X-Powered-By");
  return payload;
});

/* ---- In-memory audit log + counters (who/what/when/from where) ----------- */
interface AuditEntry {
  id: number;
  at: string;
  type: string;
  severity: "info" | "warning" | "critical";
  actor?: string;
  roles?: string[];
  ip?: string;
  detail: string;
}
let auditSeq = 0;
const auditLog: AuditEntry[] = [];
const metrics = { requests: 0, authzDenied: 0, rateLimited: 0, adminActions: 0 };

function audit(
  type: string,
  severity: AuditEntry["severity"],
  detail: string,
  context?: { actor?: string; roles?: string[]; ip?: string }
) {
  auditLog.unshift({
    id: ++auditSeq,
    at: new Date().toISOString(),
    type,
    severity,
    detail,
    actor: context?.actor,
    roles: context?.roles,
    ip: context?.ip
  });
  if (auditLog.length > 2000) auditLog.length = 2000;
  app.log.info({ audit: type, severity, actor: context?.actor, ip: context?.ip }, detail);
}

const services = {
  identity: process.env.IDENTITY_URL ?? "http://localhost:4101",
  listing: process.env.LISTING_URL ?? "http://localhost:4102",
  feed: process.env.FEED_URL ?? "http://localhost:4103",
  trust: process.env.TRUST_URL ?? "http://localhost:4104"
};

await app.register(cors, {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : true,
  credentials: true
});
await app.register(rateLimit, {
  global: true,
  max: 120,
  timeWindow: "1 minute",
  errorResponseBuilder: (request) => {
    metrics.rateLimited += 1;
    audit("rate_limited", "warning", `Rate limit hit on ${request.method} ${request.url}`, { ip: request.ip });
    return fail("RATE_LIMIT_EXCEEDED", "Too many requests. Please try again shortly.", request.id);
  }
});

app.addHook("onRequest", async (request) => {
  metrics.requests += 1;
  void request;
});

/** Per-route rate-limit config helper for sensitive endpoints. */
function limit(max: number, timeWindow = "1 minute") {
  return { config: { rateLimit: { max, timeWindow } } };
}

async function getOptionalAuth(request: { headers: Record<string, unknown> }, requestId: string) {
  const value = request.headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;

  if (!header || typeof header !== "string") {
    return undefined;
  }

  const token = header.replace(/^Bearer\s+/i, "");

  try {
    return await verifyAccessToken(token);
  } catch {
    throw fail("AUTH_TOKEN_INVALID", "Your session is invalid or expired.", requestId);
  }
}

type GatewayRequest = { headers: Record<string, unknown>; ip?: string };

function reqHeader(request: GatewayRequest, name: string): string | undefined {
  const value = request.headers[name];
  const header = Array.isArray(value) ? value[0] : value;
  return typeof header === "string" && header.length > 0 ? header : undefined;
}

async function requireAuth(request: GatewayRequest, requestId: string): Promise<AuthClaims> {
  const claims = await getOptionalAuth(request, requestId);
  if (!claims) {
    throw fail("AUTH_REQUIRED", "Please sign in to continue.", requestId);
  }
  return claims;
}

/** Enforce role-based access control. Throws an authz failure if not allowed. */
function requireRole(claims: AuthClaims, allowed: readonly string[], requestId: string, request: GatewayRequest) {
  if (!hasAnyRole(claims.roles, allowed)) {
    metrics.authzDenied += 1;
    audit("authz_denied", "warning", `Role check failed (needs ${allowed.join("/")})`, {
      actor: claims.userId,
      roles: claims.roles,
      ip: request.ip
    });
    throw fail("FORBIDDEN", "You do not have permission to perform this action.", requestId);
  }
}

/** Moderation gate: privileged role in production; self-serve allowed only in dev/demo. */
function canModerate(claims: AuthClaims): boolean {
  return isPrivileged(claims.roles) || !isProduction;
}

/** Identity-context headers forwarded to downstream services. */
function contextHeaders(claims: AuthClaims, request: GatewayRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "x-user-id": claims.userId,
    "x-user-phone": claims.phone,
    "x-user-roles": (claims.roles ?? []).join(","),
    "x-client-ip": request.ip ?? "unknown"
  };
  if (claims.sessionId) headers["x-session-id"] = claims.sessionId;
  const deviceId = reqHeader(request, "x-device-id");
  if (deviceId) headers["x-device-id"] = deviceId;
  const userAgent = reqHeader(request, "user-agent");
  if (userAgent) headers["x-user-agent"] = userAgent;
  return headers;
}

/** Device-context headers for unauthenticated flows (login, refresh). */
function deviceHeaders(request: GatewayRequest): Record<string, string> {
  const headers: Record<string, string> = { "x-client-ip": request.ip ?? "unknown" };
  const deviceId = reqHeader(request, "x-device-id");
  if (deviceId) headers["x-device-id"] = deviceId;
  const userAgent = reqHeader(request, "user-agent");
  if (userAgent) headers["x-user-agent"] = userAgent;
  return headers;
}

async function fetchVerification(claims: AuthClaims, request: GatewayRequest, requestId: string) {
  const result = await proxy<ApiResponse<VerificationRecord>>(
    `${services.identity}/verifications/me`,
    requestId,
    { headers: contextHeaders(claims, request) }
  );
  return result.body.success ? result.body.data : undefined;
}

async function proxy<T>(url: string, requestId: string, init?: RequestInit) {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
        ...(init?.headers ?? {})
      }
    });
    return {
      status: response.status,
      body: (await response.json()) as T
    };
  } catch {
    return {
      status: 503,
      body: fail("SERVICE_UNAVAILABLE", "A required service is unavailable.", requestId)
    };
  }
}

app.get("/health", async () =>
  ok({
    service: "api-gateway",
    status: "ok",
    downstream: services
  })
);

app.get("/api/v1/feed", limit(60), async (request, reply) => {
  const query = new URLSearchParams(request.query as Record<string, string>).toString();
  const result = await proxy(`${services.feed}/feed${query ? `?${query}` : ""}`, request.id);
  reply.code(result.status);
  return result.body;
});

app.get("/api/v1/me/listings", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  const result = await proxy(`${services.listing}/listings/mine`, request.id, {
    headers: contextHeaders(claims, request)
  });
  reply.code(result.status);
  return result.body;
});

app.get("/api/v1/listings/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  // Forward identity context (when present) so the listing service can decide
  // whether the requester is the owner and may see exact location.
  const claims = await getOptionalAuth(request, request.id).catch(() => undefined);
  const result = await proxy(`${services.listing}/listings/${id}`, request.id, {
    headers: claims ? contextHeaders(claims, request) : undefined
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/listings", limit(20), async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }

  const body = (request.body ?? {}) as Record<string, unknown> & {
    location?: { lat?: number; lng?: number; accuracy?: number };
    metadata?: Record<string, unknown>;
  };

  // Posting an ad requires an approved identity (govt ID on file) ...
  const verification = await fetchVerification(claims, request, request.id);
  if (!verification || verification.kycStatus !== "verified") {
    reply.code(403);
    return fail(
      "VERIFICATION_REQUIRED",
      "Verify your identity before posting. This keeps the marketplace safe.",
      request.id
    );
  }

  // ... and explicit location consent. The device IP is captured server-side.
  const location = body.location;
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    reply.code(422);
    return fail("LOCATION_REQUIRED", "Allow location access to post an ad.", request.id);
  }

  const { location: _omit, metadata = {}, ...rest } = body;
  const enriched = {
    ...rest,
    metadata: {
      ...metadata,
      verifiedPoster: true,
      ipAddress: request.ip ?? "unknown",
      lat: location.lat,
      lng: location.lng,
      locationAccuracy: location.accuracy ?? 0
    }
  };

  const result = await proxy<ApiResponse<unknown>>(`${services.listing}/listings`, request.id, {
    method: "POST",
    headers: contextHeaders(claims, request),
    body: JSON.stringify(enriched)
  });
  if (result.body.success) {
    audit("listing_created", "info", "Listing submitted for review", {
      actor: claims.userId,
      roles: claims.roles,
      ip: request.ip
    });
  }
  reply.code(result.status);
  return result.body;
});

/* ---- Identity verification (KYC) ----------------------------------------- */

app.get("/api/v1/verifications/me", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  const result = await proxy(`${services.identity}/verifications/me`, request.id, {
    headers: contextHeaders(claims, request)
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/verifications", limit(8), async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  const result = await proxy(`${services.identity}/verifications`, request.id, {
    method: "POST",
    headers: contextHeaders(claims, request),
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/admin/verifications/:userId/approve", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  if (!canModerate(claims)) {
    metrics.authzDenied += 1;
    audit("authz_denied", "warning", "Non-privileged verification approval blocked", {
      actor: claims.userId,
      roles: claims.roles,
      ip: request.ip
    });
    reply.code(403);
    return fail("FORBIDDEN", "Only reviewers can approve verifications.", request.id);
  }
  const { userId } = request.params as { userId: string };
  metrics.adminActions += 1;
  audit("verification_approved", "info", `Verification approved for ${userId}`, {
    actor: claims.userId,
    roles: claims.roles,
    ip: request.ip
  });
  const result = await proxy(`${services.identity}/verifications/${userId}/approve`, request.id, {
    method: "POST",
    body: JSON.stringify({})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/admin/verifications/:userId/reject", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  if (!canModerate(claims)) {
    reply.code(403);
    return fail("FORBIDDEN", "Only reviewers can reject verifications.", request.id);
  }
  const { userId } = request.params as { userId: string };
  metrics.adminActions += 1;
  audit("verification_rejected", "warning", `Verification rejected for ${userId}`, {
    actor: claims.userId,
    roles: claims.roles,
    ip: request.ip
  });
  const result = await proxy(`${services.identity}/verifications/${userId}/reject`, request.id, {
    method: "POST",
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

/* ---- Auth + session lifecycle -------------------------------------------- */

app.post("/api/v1/auth/register", limit(8), async (request, reply) => {
  const result = await proxy<ApiResponse<unknown>>(`${services.identity}/auth/register`, request.id, {
    method: "POST",
    headers: deviceHeaders(request),
    body: JSON.stringify(request.body ?? {})
  });
  if (result.body.success) audit("account_registered", "info", "New account created", { ip: request.ip });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/auth/login", limit(12), async (request, reply) => {
  const result = await proxy(`${services.identity}/auth/login`, request.id, {
    method: "POST",
    headers: deviceHeaders(request),
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/auth/otp/request", limit(8), async (request, reply) => {
  const result = await proxy(`${services.identity}/auth/otp/request`, request.id, {
    method: "POST",
    headers: deviceHeaders(request),
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/auth/otp/verify", limit(12), async (request, reply) => {
  const result = await proxy(`${services.identity}/auth/otp/verify`, request.id, {
    method: "POST",
    headers: deviceHeaders(request),
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/auth/refresh", limit(30), async (request, reply) => {
  const result = await proxy(`${services.identity}/auth/refresh`, request.id, {
    method: "POST",
    headers: deviceHeaders(request),
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/auth/logout", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  const result = await proxy(`${services.identity}/auth/logout`, request.id, {
    method: "POST",
    headers: contextHeaders(claims, request),
    body: JSON.stringify({})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/auth/logout-all", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  audit("logout_all", "warning", "User signed out of all devices", {
    actor: claims.userId,
    roles: claims.roles,
    ip: request.ip
  });
  const result = await proxy(`${services.identity}/auth/logout-all`, request.id, {
    method: "POST",
    headers: contextHeaders(claims, request),
    body: JSON.stringify({})
  });
  reply.code(result.status);
  return result.body;
});

app.get("/api/v1/auth/sessions", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  const result = await proxy(`${services.identity}/auth/sessions`, request.id, {
    headers: contextHeaders(claims, request)
  });
  reply.code(result.status);
  return result.body;
});

app.get("/api/v1/auth/security-events", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }
  const result = await proxy(`${services.identity}/auth/security-events`, request.id, {
    headers: contextHeaders(claims, request)
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/reports", limit(20), async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }

  const result = await proxy(`${services.trust}/reports`, request.id, {
    method: "POST",
    headers: contextHeaders(claims, request),
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/admin/listings/:id/approve", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }

  const { id } = request.params as { id: string };
  metrics.adminActions += 1;
  audit("listing_approved", "info", `Listing ${id} approved`, {
    actor: claims.userId,
    roles: claims.roles,
    ip: request.ip
  });
  const result = await proxy(`${services.listing}/listings/${id}/status`, request.id, {
    method: "POST",
    headers: contextHeaders(claims, request),
    body: JSON.stringify({ status: "active" })
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/admin/listings/:id/reject", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }

  const { id } = request.params as { id: string };
  metrics.adminActions += 1;
  audit("listing_rejected", "warning", `Listing ${id} rejected`, {
    actor: claims.userId,
    roles: claims.roles,
    ip: request.ip
  });
  const result = await proxy(`${services.listing}/listings/${id}/status`, request.id, {
    method: "POST",
    headers: contextHeaders(claims, request),
    body: JSON.stringify({ status: "rejected" })
  });
  reply.code(result.status);
  return result.body;
});

/* ---- Admin observability (audit trail + metrics) ------------------------- */

app.get("/api/v1/admin/audit", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
    requireRole(claims, PRIVILEGED_ROLES, request.id, request);
  } catch (error) {
    reply.code((error as { error?: { code?: string } })?.error?.code === "FORBIDDEN" ? 403 : 401);
    return error;
  }
  const query = request.query as { limit?: string };
  const max = Math.min(500, Number(query.limit ?? 100));
  return ok({ entries: auditLog.slice(0, max), metrics }, request.id);
});

app.get("/api/v1/admin/metrics", async (request, reply) => {
  let claims: AuthClaims;
  try {
    claims = await requireAuth(request, request.id);
    requireRole(claims, PRIVILEGED_ROLES, request.id, request);
  } catch (error) {
    reply.code((error as { error?: { code?: string } })?.error?.code === "FORBIDDEN" ? 403 : 401);
    return error;
  }
  return ok(metrics, request.id);
});

await app.listen({ port, host: "0.0.0.0" });
