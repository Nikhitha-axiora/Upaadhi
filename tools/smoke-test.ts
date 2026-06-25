import { strict as assert } from "node:assert";
import type { ApiResponse, FeedListing, Listing } from "@upaadhi/shared";

const apiBase = process.env.API_BASE ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string> | undefined) ?? {})
  };

  if (init?.body) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers
  });
  const body = (await response.json()) as ApiResponse<T>;
  assert.equal(body.success, true, JSON.stringify(body));
  return body.data;
}

async function main() {
  const otp = await request<{ devOtp?: string }>("/api/v1/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone: "+919876543210" })
  });

  assert.ok(otp.devOtp, "development OTP should be returned outside production");

  const auth = await request<{ accessToken: string }>("/api/v1/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone: "+919876543210", otp: otp.devOtp })
  });

  assert.ok(auth.accessToken, "access token should be returned");

  const listing = await request<Listing>("/api/v1/listings", {
    method: "POST",
    headers: { authorization: `Bearer ${auth.accessToken}` },
    body: JSON.stringify({
      type: "job",
      title: `Smoke test helper ${Date.now()}`,
      description: "Smoke test listing should start under review.",
      priceAmount: 500,
      priceUnit: "day",
      locality: "Ameerpet",
      city: "Hyderabad",
      urgency: "today"
    })
  });

  assert.equal(listing.status, "pending_review");

  await request<Listing>(`/api/v1/admin/listings/${listing.id}/approve`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.accessToken}` }
  });

  const feed = await request<{ listings: FeedListing[] }>("/api/v1/feed?type=job");
  assert.ok(feed.listings.some((item) => item.id === listing.id), "approved listing should appear in feed");

  const report = await request<{ id: string; status: string }>("/api/v1/reports", {
    method: "POST",
    headers: { authorization: `Bearer ${auth.accessToken}` },
    body: JSON.stringify({
      listingId: listing.id,
      reason: "smoke_test",
      details: "Smoke test report."
    })
  });

  assert.equal(report.status, "open");
  console.log("Smoke test passed.");
}

void main();
