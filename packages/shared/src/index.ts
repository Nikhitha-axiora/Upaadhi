export type ListingType = "job" | "service" | "sell" | "rent";

export type ListingStatus = "active" | "pending_review" | "closed" | "rejected" | "expired";

/** Default lifespan of a listing before it auto-expires. */
export const LISTING_TTL_DAYS = 15;
const DAY_MS = 1000 * 60 * 60 * 24;

export type VerificationStatus = "none" | "phone_verified" | "employer_verified" | "id_verified";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  locality: string;
  city: string;
  roles: string[];
  skills: string[];
  rating: number;
  completedCount: number;
  responseTimeMinutes: number;
  verificationStatus: VerificationStatus;
}

export interface Listing {
  id: string;
  ownerId: string;
  type: ListingType;
  title: string;
  description: string;
  priceAmount: number;
  priceUnit: "hour" | "day" | "week" | "month" | "fixed";
  locality: string;
  city: string;
  distanceKm: number;
  urgency: "immediate" | "today" | "this_week" | "flexible";
  status: ListingStatus;
  trustScore: number;
  postedAt: string;
  expiresAt: string;
  metadata: Record<string, string | number | boolean | string[]>;
}

/** When a listing posted at `postedAt` should expire. */
export function computeExpiry(postedAt: string, ttlDays = LISTING_TTL_DAYS): string {
  return new Date(new Date(postedAt).getTime() + ttlDays * DAY_MS).toISOString();
}

/** True once an active listing has passed its expiry time. */
export function isListingExpired(listing: Pick<Listing, "status" | "expiresAt">, now = Date.now()): boolean {
  return listing.status === "active" && new Date(listing.expiresAt).getTime() <= now;
}

/** The status to show the user, accounting for lapsed expiry. */
export function effectiveListingStatus(
  listing: Pick<Listing, "status" | "expiresAt">,
  now = Date.now()
): ListingStatus {
  return isListingExpired(listing, now) ? "expired" : listing.status;
}

/** Whole days remaining before expiry (negative once expired). */
export function daysUntilExpiry(listing: Pick<Listing, "expiresAt">, now = Date.now()): number {
  return Math.ceil((new Date(listing.expiresAt).getTime() - now) / DAY_MS);
}

export interface FeedListing extends Listing {
  owner: Pick<
    UserProfile,
    "id" | "name" | "rating" | "completedCount" | "responseTimeMinutes" | "verificationStatus"
  >;
}

export interface ReportPayload {
  listingId?: string;
  reportedUserId?: string;
  reason: string;
  details?: string;
}

/* ---- Identity verification (KYC) ----------------------------------------- */

export type IdType = "aadhaar" | "pan" | "driving_license" | "voter_id" | "passport";

export type KycStatus = "unverified" | "under_review" | "verified" | "rejected";

export interface KycLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Submitted by the client. Images are data URLs (downscaled JPEG). */
export interface VerificationSubmission {
  idType: IdType;
  idNumber: string;
  idName: string;
  selfieImage: string;
  idImage: string;
  location?: KycLocation | null;
}

/** Sensitive record persisted server-side in the user's application data. */
export interface VerificationFile extends VerificationSubmission {
  userId: string;
  kycStatus: KycStatus;
  ipAddress?: string;
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

/** Safe-to-return projection — never exposes raw images or the full ID number. */
export interface VerificationRecord {
  userId: string;
  kycStatus: KycStatus;
  idType?: IdType;
  idNumberMasked?: string;
  idName?: string;
  hasSelfie: boolean;
  hasIdPhoto: boolean;
  ipAddress?: string;
  location?: KycLocation;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export const idTypeLabels: Record<IdType, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN card",
  driving_license: "Driving licence",
  voter_id: "Voter ID",
  passport: "Passport"
};

/** Mask all but the last 4 characters of an ID number. */
export function maskIdNumber(value: string): string {
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return clean;
  return `${"•".repeat(Math.max(2, clean.length - 4))}${clean.slice(-4)}`;
}

export function toVerificationRecord(file: VerificationFile): VerificationRecord {
  return {
    userId: file.userId,
    kycStatus: file.kycStatus,
    idType: file.idType,
    idNumberMasked: file.idNumber ? maskIdNumber(file.idNumber) : undefined,
    idName: file.idName,
    hasSelfie: Boolean(file.selfieImage),
    hasIdPhoto: Boolean(file.idImage),
    ipAddress: file.ipAddress,
    location: file.location ?? undefined,
    submittedAt: file.submittedAt,
    reviewedAt: file.reviewedAt,
    rejectionReason: file.rejectionReason
  };
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, requestId = "local-request"): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  };
}

export function fail(code: string, message: string, requestId = "local-request", details = {}): ApiFailure {
  return {
    success: false,
    error: { code, message, details },
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  };
}

export const seedUsers: UserProfile[] = [
  {
    id: "usr_ravi",
    name: "Ravi Kumar",
    phone: "+919876543210",
    locality: "Ameerpet",
    city: "Hyderabad",
    roles: ["earner", "service_provider"],
    skills: ["helper", "delivery", "event support"],
    rating: 4.7,
    completedCount: 24,
    responseTimeMinutes: 8,
    verificationStatus: "phone_verified"
  },
  {
    id: "usr_lakshmi",
    name: "Lakshmi Stores",
    phone: "+919888777666",
    locality: "Ameerpet",
    city: "Hyderabad",
    roles: ["employer"],
    skills: ["retail"],
    rating: 4.5,
    completedCount: 18,
    responseTimeMinutes: 12,
    verificationStatus: "employer_verified"
  },
  {
    id: "usr_neha",
    name: "Neha Designs",
    phone: "+919111222333",
    locality: "SR Nagar",
    city: "Hyderabad",
    roles: ["service_provider"],
    skills: ["logo design", "poster design", "video editing"],
    rating: 4.9,
    completedCount: 42,
    responseTimeMinutes: 15,
    verificationStatus: "phone_verified"
  }
];

const baseSeedListings: Array<Omit<Listing, "expiresAt">> = [
  {
    id: "lst_shop_helper",
    ownerId: "usr_lakshmi",
    type: "job",
    title: "Helper needed at grocery shop",
    description: "Need one helper for billing support, shelf arrangement, and packing from 10 AM to 7 PM.",
    priceAmount: 600,
    priceUnit: "day",
    locality: "Ameerpet",
    city: "Hyderabad",
    distanceKm: 1.8,
    urgency: "today",
    status: "active",
    trustScore: 86,
    postedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    metadata: {
      duration: "full-day",
      workersRequired: 1,
      foodProvided: true
    }
  },
  {
    id: "lst_logo_design",
    ownerId: "usr_neha",
    type: "service",
    title: "Logo design for local shops",
    description: "Simple logo and poster design for stores, food stalls, and tuition centers.",
    priceAmount: 999,
    priceUnit: "fixed",
    locality: "SR Nagar",
    city: "Hyderabad",
    distanceKm: 2.4,
    urgency: "flexible",
    status: "active",
    trustScore: 82,
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    metadata: {
      deliveryDays: 2,
      revisions: 2
    }
  },
  {
    id: "lst_camera_rent",
    ownerId: "usr_ravi",
    type: "rent",
    title: "DSLR camera for rent",
    description: "Canon DSLR available for events and college shoots. ID proof required.",
    priceAmount: 500,
    priceUnit: "day",
    locality: "Panjagutta",
    city: "Hyderabad",
    distanceKm: 3.1,
    urgency: "this_week",
    status: "active",
    trustScore: 74,
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    metadata: {
      depositRequired: true,
      depositAmount: 2000
    }
  }
];

export const seedListings: Listing[] = baseSeedListings.map((listing) => ({
  ...listing,
  expiresAt: computeExpiry(listing.postedAt)
}));

export interface AuthClaims {
  userId: string;
  phone: string;
  roles: string[];
  /** Binds the access token to a server-side session for revocation. */
  sessionId?: string;
}

