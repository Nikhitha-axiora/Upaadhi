import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { ApiResponse, FeedListing, Listing, ListingType, ok, seedListings, seedUsers } from "@upaadhi/shared";

const port = Number(process.env.FEED_PORT ?? process.env.PORT ?? 4103);
const listingServiceUrl = process.env.LISTING_URL ?? "http://localhost:4102";
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

async function getListings(): Promise<Listing[]> {
  try {
    const response = await fetch(`${listingServiceUrl}/listings`);
    const body = (await response.json()) as ApiResponse<Listing[]>;

    if (body.success) {
      return body.data;
    }
  } catch {
    app.log.warn("Listing service unavailable, using seed projection.");
  }

  return seedListings;
}

function buildFeed(listings: Listing[], type?: ListingType, maxDistance = 10): FeedListing[] {
  return listings
    .filter((listing) => listing.status === "active")
    .filter((listing) => (type ? listing.type === type : true))
    .filter((listing) => listing.distanceKm <= maxDistance)
    .sort((a, b) => b.trustScore - a.trustScore || a.distanceKm - b.distanceKm)
    .map((listing) => {
      const owner = seedUsers.find((user) => user.id === listing.ownerId) ?? seedUsers[0];
      return {
        ...listing,
        owner: {
          id: owner.id,
          name: owner.name,
          rating: owner.rating,
          completedCount: owner.completedCount,
          responseTimeMinutes: owner.responseTimeMinutes,
          verificationStatus: owner.verificationStatus
        }
      };
    });
}

app.get("/health", async () => ok({ service: "feed-service", status: "ok" }));

app.get("/feed", async (request) => {
  const query = request.query as { type?: ListingType; distance?: string };
  const maxDistance = query.distance ? Number(query.distance) : 10;
  const listings = await getListings();

  return ok(
    {
      location: "Hyderabad",
      listings: buildFeed(listings, query.type, maxDistance),
      filters: {
        type: query.type ?? "all",
        distance: maxDistance
      }
    },
    request.id
  );
});

await app.listen({ port, host: "0.0.0.0" });
