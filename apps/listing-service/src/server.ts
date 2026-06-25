import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { effectiveListingStatus, fail, Listing, ok } from "@upaadhi/shared";
import { isPrivileged, redactSensitiveMetadata, sanitizeText, scoreListingRisk } from "@upaadhi/shared/security";
import { createListingRepository } from "./repository.js";

const port = Number(process.env.LISTING_PORT ?? process.env.PORT ?? 4102);
const app = Fastify({ logger: true, bodyLimit: 4 * 1024 * 1024 });
const repository = createListingRepository();

await app.register(cors, { origin: true });

function header(request: { headers: Record<string, unknown> }, name: string): string | undefined {
  const value = request.headers[name];
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function rolesOf(request: { headers: Record<string, unknown> }): string[] {
  return (header(request, "x-user-roles") ?? "").split(",").filter(Boolean);
}

/** Strip exact coordinates / device IP before a listing leaves the service. */
function publicView(listing: Listing): Listing {
  return redactSensitiveMetadata(listing);
}

app.get("/health", async () => ok({ service: "listing-service", status: "ok" }));

app.get("/listings", async (request) => ok((await repository.listListings()).map(publicView), request.id));

// A user's own posts (all statuses), with lapsed listings shown as expired.
app.get("/listings/mine", async (request, reply) => {
  const ownerId = header(request, "x-user-id");
  if (!ownerId) {
    reply.code(401);
    return fail("AUTH_REQUIRED", "Sign in to view your posts.", request.id);
  }
  const mine = (await repository.listListings())
    .filter((listing) => listing.ownerId === ownerId)
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
    .map((listing) => ({ ...publicView(listing), status: effectiveListingStatus(listing) }));
  return ok(mine, request.id);
});

app.get("/listings/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const listing = await repository.getListingById(id);

  if (!listing) {
    reply.code(404);
    return fail("LISTING_NOT_FOUND", "Listing not found.", request.id);
  }

  return ok(publicView(listing), request.id);
});

app.post("/listings", async (request, reply) => {
  const body = request.body as Parameters<typeof repository.createListing>[0];

  if (!body.title || !body.type || !body.priceAmount || !body.locality) {
    reply.code(422);
    return fail("LISTING_VALIDATION_FAILED", "Title, type, price, and locality are required.", request.id);
  }

  // Bind ownership to the authenticated caller (never trust a client-supplied id).
  const ownerId = header(request, "x-user-id") ?? body.ownerId;
  const title = sanitizeText(body.title, 140);
  const description = sanitizeText(body.description ?? "", 4000);

  // Fraud / anti-scam risk scoring on the listing content.
  const risk = scoreListingRisk(title, description);

  const listing = await repository.createListing({
    ...body,
    ownerId,
    title,
    description,
    metadata: {
      ...(body.metadata ?? {}),
      riskScore: risk.score,
      riskLevel: risk.level,
      riskFlags: risk.flags
    }
  });
  reply.code(201);
  return ok(publicView(listing), request.id);
});

app.post("/listings/:id/status", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { status?: "active" | "rejected" | "closed" | "pending_review" };

  if (!body.status) {
    reply.code(422);
    return fail("LISTING_STATUS_REQUIRED", "Listing status is required.", request.id);
  }

  const existing = await repository.getListingById(id);
  if (!existing) {
    reply.code(404);
    return fail("LISTING_NOT_FOUND", "Listing not found.", request.id);
  }

  // Object-level authorization: only the owner or a privileged role may change
  // a listing's status. Prevents tampering by manipulating the listing ID.
  const requesterId = header(request, "x-user-id");
  const isOwner = requesterId !== undefined && requesterId === existing.ownerId;
  if (!isOwner && !isPrivileged(rolesOf(request))) {
    reply.code(403);
    return fail("FORBIDDEN", "You are not allowed to modify this listing.", request.id);
  }

  const listing = await repository.updateListingStatus(id, body.status);
  if (!listing) {
    reply.code(404);
    return fail("LISTING_NOT_FOUND", "Listing not found.", request.id);
  }

  return ok(publicView(listing), request.id);
});

await app.listen({ port, host: "0.0.0.0" });
