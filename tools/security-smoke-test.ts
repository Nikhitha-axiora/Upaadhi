import { strict as assert } from "node:assert";

/**
 * Security regression smoke test. Proves the hidden security controls actually
 * enforce — object-level authorization, location-privacy redaction, refresh
 * rotation + reuse detection, OTP throttling, RBAC, fraud scoring, input
 * sanitisation, and security headers.
 *
 * Runs against the local gateway, plus a direct call to the listing service to
 * exercise object-level authz with a forged identity (the seed deployment has a
 * single user, so a different owner can only be simulated below the gateway).
 */
const gw = process.env.API_BASE ?? "http://localhost:4000";
const listingService = process.env.LISTING_URL ?? "http://localhost:4102";

const sampleImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

interface Json {
  status: number;
  headers: Headers;
  body: any;
}

async function call(base: string, path: string, init?: RequestInit): Promise<Json> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };
  if (init?.body) headers["content-type"] = "application/json";
  const response = await fetch(`${base}${path}`, { ...init, headers });
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => ({})) };
}

async function login(phone: string) {
  const otp = await call(gw, "/api/v1/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) });
  assert.ok(otp.body.success, `otp request failed: ${JSON.stringify(otp.body)}`);
  const verify = await call(gw, "/api/v1/auth/otp/verify", {
    method: "POST",
    headers: { "x-device-id": `dev-${phone}` },
    body: JSON.stringify({ phone, otp: otp.body.data.devOtp })
  });
  assert.ok(verify.body.success, `otp verify failed: ${JSON.stringify(verify.body)}`);
  return verify.body.data as { accessToken: string; refreshToken: string; user: { id: string } };
}

async function ensureVerified(token: string) {
  const auth = { authorization: `Bearer ${token}` };
  const submitted = await call(gw, "/api/v1/verifications", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      idType: "aadhaar",
      idNumber: "123412341234",
      idName: "Ravi Kumar",
      idImage: sampleImage,
      selfieImage: sampleImage
    })
  });
  const userId = submitted.body.data.userId as string;
  await call(gw, `/api/v1/admin/verifications/${userId}/approve`, { method: "POST", headers: auth });
  return userId;
}

async function createListing(token: string, overrides: Record<string, unknown> = {}) {
  return call(gw, "/api/v1/listings", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: "job",
      title: "Helper needed",
      description: "Local shop work.",
      priceAmount: 600,
      priceUnit: "day",
      locality: "Ameerpet",
      city: "Hyderabad",
      urgency: "today",
      location: { lat: 17.448921, lng: 78.391122, accuracy: 18 },
      ...overrides
    })
  });
}

async function main() {
  const session = await login("+919876500001");
  const auth = { authorization: `Bearer ${session.accessToken}` };
  const userId = await ensureVerified(session.accessToken);

  /* 1. Security headers present on every response ------------------------- */
  const health = await call(gw, "/health");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff", "missing nosniff header");
  assert.equal(health.headers.get("x-frame-options"), "DENY", "missing frame-options header");
  console.log("✓ security headers applied");

  /* 2. Input sanitisation (stored XSS neutralised) ------------------------ */
  const xss = await createListing(session.accessToken, { title: "<script>alert(1)</script> Cook" });
  assert.ok(xss.body.success, JSON.stringify(xss.body));
  assert.ok(!String(xss.body.data.title).includes("<script>"), "raw <script> was not sanitised");
  console.log("✓ input sanitisation neutralises script tags");

  /* 3. Fraud risk scoring on scammy content ------------------------------- */
  const scam = await createListing(session.accessToken, {
    title: "Easy job",
    description: "Pay registration fee 500 to get the job. WhatsApp me at 9876543210."
  });
  assert.ok(scam.body.success, JSON.stringify(scam.body));
  assert.equal(scam.body.data.metadata.riskLevel, "high", "scam listing should score high risk");
  assert.ok((scam.body.data.metadata.riskFlags ?? []).includes("advance_fee"), "should flag advance_fee");
  console.log("✓ fraud scoring flags advance-fee scams");

  /* 4. Object-level authorization (below the gateway, forged identity) ---- */
  const owned = await createListing(session.accessToken);
  const listingId = owned.body.data.id as string;
  const asAttacker = await call(listingService, `/listings/${listingId}/status`, {
    method: "POST",
    headers: { "x-user-id": "usr_attacker", "x-user-roles": "earner" },
    body: JSON.stringify({ status: "active" })
  });
  assert.equal(asAttacker.status, 403, "non-owner must not change listing status");
  assert.equal(asAttacker.body.error.code, "FORBIDDEN");
  const asModerator = await call(listingService, `/listings/${listingId}/status`, {
    method: "POST",
    headers: { "x-user-id": "usr_attacker", "x-user-roles": "moderator" },
    body: JSON.stringify({ status: "active" })
  });
  assert.ok(asModerator.body.success, "moderator should be allowed to moderate");
  console.log("✓ object-level authorization blocks non-owners, allows moderators");

  /* 5. Location privacy: feed never exposes exact coords or device IP ----- */
  await call(gw, `/api/v1/admin/listings/${listingId}/approve`, { method: "POST", headers: auth });
  const feed = await call(gw, "/api/v1/feed?type=job");
  const inFeed = feed.body.data.listings.find((item: { id: string }) => item.id === listingId);
  assert.ok(inFeed, "approved listing should appear in feed");
  for (const leak of ["lat", "lng", "ipAddress", "locationAccuracy"]) {
    assert.equal(inFeed.metadata[leak], undefined, `feed leaked ${leak}`);
  }
  assert.equal(inFeed.metadata.locationPrecision, "approximate");
  console.log("✓ location privacy: exact coordinates and IP redacted from feed");

  /* 6. RBAC: admin audit trail denied to non-privileged users ------------- */
  const audit = await call(gw, "/api/v1/admin/audit", { headers: auth });
  assert.equal(audit.status, 403, "non-admin must not read the audit trail");
  console.log("✓ RBAC blocks audit-log access for non-admins");

  /* 7. Refresh rotation + stolen-token reuse detection -------------------- */
  const r1 = session.refreshToken;
  const rotate1 = await call(gw, "/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: r1 }) });
  assert.ok(rotate1.body.success, "first refresh should succeed");
  const r2 = rotate1.body.data.refreshToken as string;
  assert.notEqual(r1, r2, "refresh token must rotate");

  const replay = await call(gw, "/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: r1 }) });
  assert.equal(replay.status, 401, "reused refresh token must be rejected");

  const afterReuse = await call(gw, "/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: r2 }) });
  assert.equal(afterReuse.status, 401, "session family must be revoked after reuse");
  console.log("✓ refresh rotation + reuse detection (family revocation)");

  /* 8. OTP brute-force throttling ----------------------------------------- */
  let throttled = false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const res = await call(gw, "/api/v1/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone: "+919876500099" })
    });
    if (res.status === 429) {
      throttled = true;
      break;
    }
  }
  assert.ok(throttled, "OTP requests should be throttled after repeated attempts");
  console.log("✓ OTP brute-force throttling engaged");

  /* 9. Security event trail records the new-device login ------------------ */
  const events = await call(gw, "/api/v1/auth/security-events", { headers: auth });
  assert.ok(events.body.success && Array.isArray(events.body.data), "security events should be listed");
  assert.ok(events.body.data.some((event: { type: string }) => event.type === "login"), "login event recorded");
  console.log("✓ per-user security event trail recorded");

  void userId;
  console.log("\nSecurity smoke test passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
