import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { fail, ok } from "@upaadhi/shared";
import { createListingRepository } from "./repository.js";

const port = Number(process.env.LISTING_PORT ?? process.env.PORT ?? 4102);
const app = Fastify({ logger: true });
const repository = createListingRepository();

await app.register(cors, { origin: true });

app.get("/health", async () => ok({ service: "listing-service", status: "ok" }));

app.get("/listings", async (request) => ok(await repository.listListings(), request.id));

app.get("/listings/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const listing = await repository.getListingById(id);

  if (!listing) {
    reply.code(404);
    return fail("LISTING_NOT_FOUND", "Listing not found.", request.id);
  }

  return ok(listing, request.id);
});

app.post("/listings", async (request, reply) => {
  const body = request.body as Parameters<typeof repository.createListing>[0];

  if (!body.title || !body.type || !body.priceAmount || !body.locality) {
    reply.code(422);
    return fail("LISTING_VALIDATION_FAILED", "Title, type, price, and locality are required.", request.id);
  }

  const listing = await repository.createListing(body);
  reply.code(201);
  return ok(listing, request.id);
});

app.post("/listings/:id/status", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { status?: "active" | "rejected" | "closed" | "pending_review" };

  if (!body.status) {
    reply.code(422);
    return fail("LISTING_STATUS_REQUIRED", "Listing status is required.", request.id);
  }

  const listing = await repository.updateListingStatus(id, body.status);

  if (!listing) {
    reply.code(404);
    return fail("LISTING_NOT_FOUND", "Listing not found.", request.id);
  }

  return ok(listing, request.id);
});

await app.listen({ port, host: "0.0.0.0" });
