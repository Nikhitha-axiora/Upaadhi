/* ============================================================================
   Upaadhi - security primitives (framework-free, dependency-free)
   Pure helpers used across services for the "hidden" security layer:
   input sanitisation, image-upload validation, location-privacy redaction,
   role checks, and marketplace fraud risk scoring.
   ========================================================================== */

/* ---- Roles & access control ---------------------------------------------- */

export type Role =
  | "earner"
  | "service_provider"
  | "employer"
  | "buyer"
  | "seller"
  | "support"
  | "moderator"
  | "admin"
  | "super_admin";

export const PRIVILEGED_ROLES: Role[] = ["moderator", "admin", "super_admin"];

export function hasAnyRole(userRoles: readonly string[] | undefined, allowed: readonly string[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some((role) => allowed.includes(role));
}

export function isPrivileged(userRoles: readonly string[] | undefined): boolean {
  return hasAnyRole(userRoles, PRIVILEGED_ROLES);
}

/* ---- Input sanitisation & validation ------------------------------------- */

// Control chars (C0 + DEL + C1) and Unicode bidi overrides used for spoofing.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F-\\u009F]", "g");
const BIDI_OVERRIDES = new RegExp("[\\u202A-\\u202E\\u2066-\\u2069]", "g");

/** Strip control chars / bidi overrides and HTML-encode angle brackets, then cap length. */
export function sanitizeText(value: unknown, maxLength = 2000): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS, "")
    .replace(BIDI_OVERRIDES, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
    .slice(0, maxLength);
}

/** Reject obviously hostile payloads outright (used before sanitising). */
export function looksMalicious(value: string): boolean {
  return /<script|javascript:|onerror\s*=|onload\s*=|data:text\/html|\bunion\b[\s\S]+\bselect\b|\$where|\{\s*\$ne\s*\}/i.test(
    value
  );
}

const ALLOWED_IMAGE_PREFIXES = ["data:image/png", "data:image/jpeg", "data:image/jpg", "data:image/webp"];

export interface ImageValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a base64 image data URL: allow-list the MIME type (note: SVG is
 * rejected - it is an XSS vector), and enforce a maximum decoded size.
 */
export function validateImageDataUrl(value: unknown, maxBytes = 5 * 1024 * 1024): ImageValidationResult {
  if (typeof value !== "string") return { ok: false, reason: "Image is required." };
  const isAllowed = ALLOWED_IMAGE_PREFIXES.some((prefix) => value.startsWith(prefix));
  if (!isAllowed) return { ok: false, reason: "Only PNG, JPEG or WebP images are allowed." };
  const base64 = value.slice(value.indexOf(",") + 1);
  if (base64.length < 16) return { ok: false, reason: "Image data is empty or corrupt." };
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > maxBytes) return { ok: false, reason: "Image exceeds the maximum allowed size." };
  return { ok: true };
}

/* ---- Location privacy ----------------------------------------------------- */

/** Metadata keys that must never reach the public surface. */
export const SENSITIVE_METADATA_KEYS = ["lat", "lng", "locationAccuracy", "ipAddress"] as const;

/**
 * Remove exact coordinates and device/IP fields from listing metadata before
 * it leaves the platform. Public discovery uses approximate locality only.
 */
export function redactSensitiveMetadata<T extends { metadata?: Record<string, unknown> }>(entity: T): T {
  if (!entity.metadata) return entity;
  const metadata: Record<string, unknown> = { ...entity.metadata };
  let changed = false;
  for (const key of SENSITIVE_METADATA_KEYS) {
    if (key in metadata) {
      delete metadata[key];
      changed = true;
    }
  }
  if (changed) metadata.locationPrecision = "approximate";
  return { ...entity, metadata };
}

/** Coarsen coordinates to ~1km for any approximate display use. */
export function coarsenCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ---- Fraud / risk scoring ------------------------------------------------- */

export interface RiskAssessment {
  score: number; // 0 (clean) ... 100 (high risk)
  level: "low" | "medium" | "high";
  flags: string[];
}

const SCAM_PATTERNS: Array<{ test: RegExp; weight: number; flag: string }> = [
  { test: /\b(registration|processing|joining|security)\s*(fee|charge|amount)\b/i, weight: 45, flag: "advance_fee" },
  { test: /\bpay\s*(?:rs\.?|inr)?\s*\d+[\s\S]*(to (get|apply|join|register))/i, weight: 45, flag: "pay_to_apply" },
  { test: /\b(work from home|earn \d+ daily|guaranteed (income|job)|no experience needed)\b/i, weight: 20, flag: "too_good" },
  { test: /\b(whats?app|telegram|signal)\b/i, weight: 20, flag: "off_platform_contact" },
  { test: /\b[\w.+-]+@(gmail|yahoo|outlook|hotmail)\.[a-z]+\b/i, weight: 15, flag: "personal_email" },
  { test: /(?:\+?91[\-\s]?)?[6-9]\d{9}\b/, weight: 25, flag: "phone_in_text" },
  { test: /https?:\/\/|bit\.ly|tinyurl/i, weight: 20, flag: "external_link" }
];

export function scoreListingRisk(title: string, description: string): RiskAssessment {
  const haystack = `${title}\n${description}`;
  const flags: string[] = [];
  let score = 0;
  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test.test(haystack)) {
      score += pattern.weight;
      flags.push(pattern.flag);
    }
  }
  score = Math.min(100, score);
  const level: RiskAssessment["level"] = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { score, level, flags };
}
