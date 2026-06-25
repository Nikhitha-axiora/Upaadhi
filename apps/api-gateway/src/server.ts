import "dotenv/config";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { fail, ok } from "@upaadhi/shared";
import { verifyAccessToken } from "@upaadhi/shared/auth";

const port = Number(process.env.PORT ?? 4000);
const app = Fastify({ logger: true });

const services = {
  identity: process.env.IDENTITY_URL ?? "http://localhost:4101",
  listing: process.env.LISTING_URL ?? "http://localhost:4102",
  feed: process.env.FEED_URL ?? "http://localhost:4103",
  trust: process.env.TRUST_URL ?? "http://localhost:4104"
};

await app.register(cors, { origin: true });
await app.register(rateLimit, {
  max: 120,
  timeWindow: "1 minute",
  errorResponseBuilder: (request) => fail("RATE_LIMIT_EXCEEDED", "Too many requests. Please try again shortly.", request.id)
});

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

app.get("/api/v1/feed", async (request, reply) => {
  const query = new URLSearchParams(request.query as Record<string, string>).toString();
  const result = await proxy(`${services.feed}/feed${query ? `?${query}` : ""}`, request.id);
  reply.code(result.status);
  return result.body;
});

app.get("/api/v1/listings/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = await proxy(`${services.listing}/listings/${id}`, request.id);
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/listings", async (request, reply) => {
  try {
    await getOptionalAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }

  const result = await proxy(`${services.listing}/listings`, request.id, {
    method: "POST",
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/auth/otp/request", async (request, reply) => {
  const result = await proxy(`${services.identity}/auth/otp/request`, request.id, {
    method: "POST",
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/auth/otp/verify", async (request, reply) => {
  const result = await proxy(`${services.identity}/auth/otp/verify`, request.id, {
    method: "POST",
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/reports", async (request, reply) => {
  try {
    await getOptionalAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }

  const result = await proxy(`${services.trust}/reports`, request.id, {
    method: "POST",
    body: JSON.stringify(request.body ?? {})
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/admin/listings/:id/approve", async (request, reply) => {
  try {
    await getOptionalAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }

  const { id } = request.params as { id: string };
  const result = await proxy(`${services.listing}/listings/${id}/status`, request.id, {
    method: "POST",
    body: JSON.stringify({ status: "active" })
  });
  reply.code(result.status);
  return result.body;
});

app.post("/api/v1/admin/listings/:id/reject", async (request, reply) => {
  try {
    await getOptionalAuth(request, request.id);
  } catch (error) {
    reply.code(401);
    return error;
  }

  const { id } = request.params as { id: string };
  const result = await proxy(`${services.listing}/listings/${id}/status`, request.id, {
    method: "POST",
    body: JSON.stringify({ status: "rejected" })
  });
  reply.code(result.status);
  return result.body;
});

await app.listen({ port, host: "0.0.0.0" });
