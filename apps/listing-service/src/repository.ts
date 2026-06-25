import { randomUUID } from "node:crypto";
import { isDatabaseConfigured, query } from "@upaadhi/db";
import { Listing, ListingStatus, ListingType, seedListings } from "@upaadhi/shared";

interface ListingRow {
  id: string;
  owner_id: string;
  type: ListingType;
  title: string;
  description: string;
  price_amount: string;
  price_unit: Listing["priceUnit"];
  locality: string;
  city: string;
  distance_km: string;
  urgency: Listing["urgency"];
  status: ListingStatus;
  trust_score: number;
  posted_at: Date;
  metadata: Listing["metadata"];
}

export interface CreateListingInput {
  ownerId?: string;
  type?: ListingType;
  title?: string;
  description?: string;
  priceAmount?: number;
  priceUnit?: Listing["priceUnit"];
  locality?: string;
  city?: string;
  distanceKm?: number;
  urgency?: Listing["urgency"];
  metadata?: Listing["metadata"];
}

export interface ListingRepository {
  listListings(): Promise<Listing[]>;
  getListingById(id: string): Promise<Listing | undefined>;
  createListing(input: CreateListingInput): Promise<Listing>;
  updateListingStatus(id: string, status: ListingStatus): Promise<Listing | undefined>;
}

function mapListing(row: ListingRow): Listing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    type: row.type,
    title: row.title,
    description: row.description,
    priceAmount: Number(row.price_amount),
    priceUnit: row.price_unit,
    locality: row.locality,
    city: row.city,
    distanceKm: Number(row.distance_km),
    urgency: row.urgency,
    status: row.status,
    trustScore: row.trust_score,
    postedAt: row.posted_at.toISOString(),
    metadata: row.metadata
  };
}

function buildListing(input: CreateListingInput): Listing {
  if (!input.title || !input.type || !input.priceAmount || !input.locality) {
    throw new Error("LISTING_VALIDATION_FAILED");
  }

  return {
    id: `lst_${randomUUID()}`,
    ownerId: input.ownerId ?? "usr_ravi",
    type: input.type,
    title: input.title,
    description: input.description ?? "",
    priceAmount: input.priceAmount,
    priceUnit: input.priceUnit ?? "fixed",
    locality: input.locality,
    city: input.city ?? "Hyderabad",
    distanceKm: input.distanceKm ?? 1,
    urgency: input.urgency ?? "today",
    status: "pending_review",
    trustScore: 70,
    postedAt: new Date().toISOString(),
    metadata: input.metadata ?? {}
  };
}

class MemoryListingRepository implements ListingRepository {
  private listings = [...seedListings];

  async listListings() {
    return this.listings;
  }

  async getListingById(id: string) {
    return this.listings.find((item) => item.id === id);
  }

  async createListing(input: CreateListingInput) {
    const listing = buildListing(input);
    this.listings.unshift(listing);
    return listing;
  }

  async updateListingStatus(id: string, status: ListingStatus) {
    const index = this.listings.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    this.listings[index] = { ...this.listings[index], status };
    return this.listings[index];
  }
}

class PostgresListingRepository implements ListingRepository {
  async listListings() {
    const result = await query<ListingRow>(`
      SELECT id, owner_id, type, title, description, price_amount, price_unit, locality, city, distance_km,
             urgency, status, trust_score, metadata, posted_at
      FROM listing.listings
      ORDER BY posted_at DESC
    `);
    return result.rows.map(mapListing);
  }

  async getListingById(id: string) {
    const result = await query<ListingRow>(
      `
        SELECT id, owner_id, type, title, description, price_amount, price_unit, locality, city, distance_km,
               urgency, status, trust_score, metadata, posted_at
        FROM listing.listings
        WHERE id = $1
      `,
      [id]
    );
    return result.rows[0] ? mapListing(result.rows[0]) : undefined;
  }

  async createListing(input: CreateListingInput) {
    const listing = buildListing(input);
    const result = await query<ListingRow>(
      `
        INSERT INTO listing.listings (
          id, owner_id, type, title, description, price_amount, price_unit, locality, city,
          distance_km, urgency, status, trust_score, metadata, posted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, owner_id, type, title, description, price_amount, price_unit, locality, city,
                  distance_km, urgency, status, trust_score, metadata, posted_at
      `,
      [
        listing.id,
        listing.ownerId,
        listing.type,
        listing.title,
        listing.description,
        listing.priceAmount,
        listing.priceUnit,
        listing.locality,
        listing.city,
        listing.distanceKm,
        listing.urgency,
        listing.status,
        listing.trustScore,
        listing.metadata,
        listing.postedAt
      ]
    );
    return mapListing(result.rows[0]);
  }

  async updateListingStatus(id: string, status: ListingStatus) {
    const result = await query<ListingRow>(
      `
        UPDATE listing.listings
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, owner_id, type, title, description, price_amount, price_unit, locality, city,
                  distance_km, urgency, status, trust_score, metadata, posted_at
      `,
      [id, status]
    );
    return result.rows[0] ? mapListing(result.rows[0]) : undefined;
  }
}

export function createListingRepository(): ListingRepository {
  return isDatabaseConfigured() ? new PostgresListingRepository() : new MemoryListingRepository();
}
