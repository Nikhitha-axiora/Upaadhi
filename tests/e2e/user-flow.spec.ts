import { expect, test } from "@playwright/test";

test.describe("Upaadhi local user flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("logs in, views feed, filters, posts, approves, reports, and tests actions", async ({ page }, testInfo) => {
    await expect(page.getByRole("heading", { name: "Login to test the local app" })).toBeVisible();

    await page.getByLabel("Phone number").fill(`+919${Date.now().toString().slice(-9)}${testInfo.parallelIndex}`);
    await page.getByRole("button", { name: "Request OTP" }).click();
    const status = page.locator(".status-box").first();
    await expect(status).toContainText("OTP generated");

    const statusText = await status.textContent();
    const otp = statusText?.match(/\d{6}/)?.[0];
    expect(otp).toBeTruthy();

    await page.getByLabel("OTP").fill(otp!);
    await page.getByRole("button", { name: "Verify and login" }).click();

    await expect(page.getByRole("heading", { name: "Nearby feed" })).toBeVisible();
    await expect(page.locator(".listing-card h3", { hasText: "Helper needed at grocery shop" })).toBeVisible();

    await page.getByRole("button", { name: "Jobs" }).click();
    await expect(page.locator(".listing-card h3", { hasText: "Helper needed at grocery shop" })).toBeVisible();

    await page.getByRole("button", { name: "Call" }).click();
    await expect(page.locator(".status-box")).toContainText("Call clicked");

    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(page.locator(".status-box")).toContainText("Chat opened");

    await page.getByRole("button", { name: "Report listing" }).click();
    await expect(page.locator(".status-box")).toContainText("Report created");

    const title = `UI test helper ${testInfo.project.name} ${Date.now()}`;
    await page.getByPlaceholder("Job title").fill(title);
    await page.getByPlaceholder("Pay per day").fill("700");
    await page.getByRole("button", { name: "Publish for review" }).click();
    await expect(page.locator(".status-box")).toContainText("pending_review");
    await expect(page.locator(".review-box strong", { hasText: title })).toBeVisible();

    await page.getByRole("button", { name: "Approve and show in feed" }).click();
    await expect(page.locator(".status-box")).toContainText("Approved");
    await expect(page.locator(".listing-card h3", { hasText: title })).toBeVisible();
  });

  test("keeps layout usable on the local login screen", async ({ page }) => {
    await expect(page.locator(".login-panel")).toBeVisible();
    await expect(page.getByLabel("Phone number")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request OTP" })).toBeVisible();
  });

  test("opens Feed, Post, Chats and Profile modules", async ({ page }, testInfo) => {
    await page.getByLabel("Phone number").fill(`+917${Date.now().toString().slice(-9)}${testInfo.parallelIndex}`);
    await page.getByRole("button", { name: "Request OTP" }).click();
    const status = page.locator(".status-box").first();
    await expect(status).toContainText("OTP generated");
    const otp = (await status.textContent())?.match(/\d{6}/)?.[0];
    expect(otp).toBeTruthy();
    await page.getByLabel("OTP").fill(otp!);
    await page.getByRole("button", { name: "Verify and login" }).click();

    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nearby feed" })).toBeVisible();

    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Post opportunity" })).toBeVisible();

    await page.getByRole("button", { name: "Chats", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
    await expect(page.getByText("Lakshmi Stores")).toBeVisible();

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.locator(".profile-card h3", { hasText: "Ravi Kumar" })).toBeVisible();
  });
});
