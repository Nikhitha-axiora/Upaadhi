import { expect, request, test } from "@playwright/test";

const apiBase = process.env.API_BASE ?? "http://localhost:4000";

test.describe("API auth and CRUD-like marketplace operations", () => {
  test("authenticates, creates listing, approves listing, reads feed, reports listing", async ({}, testInfo) => {
    const api = await request.newContext({ baseURL: apiBase });
    const phone = `+918${Date.now().toString().slice(-9)}${testInfo.parallelIndex}`;

    const otpResponse = await api.post("/api/v1/auth/otp/request", {
      data: { phone }
    });
    expect(otpResponse.ok()).toBeTruthy();
    const otpBody = await otpResponse.json();
    expect(otpBody.success).toBeTruthy();
    expect(otpBody.data.devOtp).toMatch(/^\d{6}$/);

    const loginResponse = await api.post("/api/v1/auth/otp/verify", {
      data: { phone, otp: otpBody.data.devOtp }
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginBody = await loginResponse.json();
    const token = loginBody.data.accessToken;
    expect(token).toBeTruthy();
    const authHeaders = { authorization: `Bearer ${token}` };

    // 1x1 transparent PNG placeholder for selfie + ID uploads.
    const sampleImage =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const verifyResponse = await api.post("/api/v1/verifications", {
      headers: authHeaders,
      data: {
        idType: "aadhaar",
        idNumber: "123412341234",
        idName: "Ravi Kumar",
        idImage: sampleImage,
        selfieImage: sampleImage
      }
    });
    expect(verifyResponse.status()).toBe(201);
    const verifyBody = await verifyResponse.json();
    expect(verifyBody.data.kycStatus).toBe("under_review");

    const approveVerification = await api.post(
      `/api/v1/admin/verifications/${verifyBody.data.userId}/approve`,
      { headers: authHeaders }
    );
    expect(approveVerification.ok()).toBeTruthy();

    const createResponse = await api.post("/api/v1/listings", {
      headers: authHeaders,
      data: {
        type: "job",
        title: `API CRUD helper ${Date.now()}`,
        description: "API test listing.",
        priceAmount: 650,
        priceUnit: "day",
        locality: "Ameerpet",
        city: "Hyderabad",
        urgency: "today",
        location: { lat: 17.437, lng: 78.448, accuracy: 20 }
      }
    });
    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.data.status).toBe("pending_review");

    const approveResponse = await api.post(`/api/v1/admin/listings/${createBody.data.id}/approve`, {
      headers: { authorization: `Bearer ${token}` }
    });
    expect(approveResponse.ok()).toBeTruthy();
    const approveBody = await approveResponse.json();
    expect(approveBody.data.status).toBe("active");

    const feedResponse = await api.get("/api/v1/feed?type=job");
    expect(feedResponse.ok()).toBeTruthy();
    const feedBody = await feedResponse.json();
    expect(feedBody.data.listings.some((item: { id: string }) => item.id === createBody.data.id)).toBeTruthy();

    const reportResponse = await api.post("/api/v1/reports", {
      headers: { authorization: `Bearer ${token}` },
      data: {
        listingId: createBody.data.id,
        reason: "api_test",
        details: "API CRUD test report."
      }
    });
    expect(reportResponse.status()).toBe(201);
    const reportBody = await reportResponse.json();
    expect(reportBody.data.status).toBe("open");

    await api.dispose();
  });

  test("rejects invalid OTP and validates listing payload", async () => {
    const api = await request.newContext({ baseURL: apiBase });

    const invalidOtp = await api.post("/api/v1/auth/otp/verify", {
      data: { phone: "+919876543210", otp: "000000" }
    });
    expect(invalidOtp.status()).toBe(401);

    const invalidListing = await api.post("/api/v1/listings", {
      data: { title: "Missing auth and fields" }
    });
    expect([401, 422]).toContain(invalidListing.status());

    await api.dispose();
  });
});
