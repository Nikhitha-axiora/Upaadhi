import "dotenv/config";
import crypto from "node:crypto";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { fail, IdType, KycLocation, ok, VerificationSubmission } from "@upaadhi/shared";
import { signAccessToken } from "@upaadhi/shared/auth";
import { validateImageDataUrl } from "@upaadhi/shared/security";
import { createIdentityRepository } from "./repository.js";
import { createVerificationStore } from "./verification.js";
import { createSessionSecurity, type DeviceContext } from "./sessions.js";
import { credentials } from "./credentials.js";
import type { UserProfile } from "@upaadhi/shared";

const port = Number(process.env.IDENTITY_PORT ?? process.env.PORT ?? 4101);
// Verification submissions carry downscaled selfie + ID images as data URLs.
const app = Fastify({ logger: true, bodyLimit: 16 * 1024 * 1024 });
const repository = createIdentityRepository();
const verifications = createVerificationStore();
const sessions = createSessionSecurity();

const idTypes: IdType[] = ["aadhaar", "pan", "driving_license", "voter_id", "passport"];

function requireUserId(request: { headers: Record<string, unknown> }): string | undefined {
  const value = request.headers["x-user-id"];
  const header = Array.isArray(value) ? value[0] : value;
  return typeof header === "string" && header.length > 0 ? header : undefined;
}

function headerValue(request: { headers: Record<string, unknown> }, name: string): string | undefined {
  const value = request.headers[name];
  const header = Array.isArray(value) ? value[0] : value;
  return typeof header === "string" && header.length > 0 ? header : undefined;
}

function clientIp(request: { headers: Record<string, unknown> }): string | undefined {
  return headerValue(request, "x-client-ip");
}

function deviceContext(request: { headers: Record<string, unknown> }): DeviceContext {
  return {
    deviceId: headerValue(request, "x-device-id"),
    userAgent: headerValue(request, "x-user-agent") ?? headerValue(request, "user-agent"),
    ip: clientIp(request)
  };
}

/** Issue a fresh session (access + rotating refresh) for a user. */
async function issueSession(user: UserProfile, request: { headers: Record<string, unknown> }) {
  const login = sessions.recordLogin(user.id, deviceContext(request));
  return {
    accessToken: await signAccessToken({
      userId: user.id,
      phone: user.phone,
      roles: user.roles,
      sessionId: login.sessionId
    }),
    refreshToken: login.refreshToken,
    expiresIn: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 600),
    newDevice: login.isNewDevice,
    user
  };
}

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(phone: string, otp: string) {
  return crypto
    .createHash("sha256")
    .update(`${phone}:${otp}:${process.env.OTP_PEPPER ?? "local-otp-pepper"}`)
    .digest("hex");
}

await app.register(cors, { origin: true });

app.get("/health", async () => ok({ service: "identity-service", status: "ok" }));

app.get("/users", async (request) => ok(await repository.listUsers(), request.id));

app.get("/users/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await repository.getUserById(id);

  if (!user) {
    reply.code(404);
    return fail("USER_NOT_FOUND", "User not found.", request.id);
  }

  return ok(user, request.id);
});

app.post("/auth/otp/request", async (request, reply) => {
  const body = request.body as { phone?: string };

  if (!body.phone) {
    reply.code(422);
    return fail("PHONE_REQUIRED", "Phone number is required.", request.id);
  }

  // OTP brute-force defence: throttle requests and honour lockouts silently.
  const gate = sessions.canRequestOtp(body.phone);
  if (!gate.allowed) {
    sessions.addEvent(body.phone, "otp_throttled", "Too many OTP requests blocked", "warning", clientIp(request));
    reply.code(429).header("retry-after", String(gate.retryAfterSeconds ?? 60));
    return fail("OTP_RATE_LIMITED", "Too many OTP requests. Please wait and try again.", request.id);
  }
  sessions.recordOtpRequest(body.phone);

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + Number(process.env.OTP_TTL_SECONDS ?? 300) * 1000);

  await repository.createOtpChallenge(body.phone, hashOtp(body.phone, otp), expiresAt);

  return ok(
    {
      phone: body.phone,
      otpSent: true,
      devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
      message: "OTP generated."
    },
    request.id
  );
});

app.post("/auth/otp/verify", async (request, reply) => {
  const body = request.body as { phone?: string; otp?: string };

  if (!body.phone || !body.otp) {
    reply.code(422);
    return fail("AUTH_OTP_REQUIRED", "Phone and verification code are required.", request.id);
  }

  if (sessions.isPhoneLocked(body.phone)) {
    reply.code(429);
    return fail("AUTH_TEMP_LOCKED", "Too many attempts. Please try again later.", request.id);
  }

  const isValidOtp = await repository.verifyOtpChallenge(body.phone, hashOtp(body.phone, body.otp));

  if (!isValidOtp) {
    sessions.recordOtpFailure(body.phone, clientIp(request));
    reply.code(401);
    return fail("AUTH_OTP_INVALID", "Invalid verification code.", request.id);
  }

  sessions.clearOtpFailures(body.phone);

  // Resolve the account that owns this phone; provision one on first OTP sign-in.
  const user =
    (await repository.getUserByPhone(body.phone)) ??
    (await repository.createUser({ name: `Member ${body.phone.slice(-4)}`, phone: body.phone }));

  return ok(await issueSession(user, request), request.id);
});

/* ---- Registration + password login --------------------------------------- */

app.post("/auth/register", async (request, reply) => {
  const body = (request.body ?? {}) as { name?: string; phone?: string; password?: string };
  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const password = body.password ?? "";

  if (name.length < 2) {
    reply.code(422);
    return fail("NAME_REQUIRED", "Enter your name.", request.id);
  }
  if (!/^\+?\d{10,15}$/.test(phone)) {
    reply.code(422);
    return fail("PHONE_INVALID", "Enter a valid mobile number.", request.id);
  }
  if (password.length < 6) {
    reply.code(422);
    return fail("PASSWORD_WEAK", "Use a password of at least 6 characters.", request.id);
  }

  if (await repository.getUserByPhone(phone)) {
    reply.code(409);
    return fail("ACCOUNT_EXISTS", "An account with this number already exists. Please log in.", request.id);
  }

  const user = await repository.createUser({ name, phone });
  credentials.set(user.id, password);
  reply.code(201);
  return ok(await issueSession(user, request), request.id);
});

app.post("/auth/login", async (request, reply) => {
  const body = (request.body ?? {}) as { phone?: string; password?: string };
  const phone = (body.phone ?? "").trim();
  const password = body.password ?? "";

  if (!phone || !password) {
    reply.code(422);
    return fail("CREDENTIALS_REQUIRED", "Enter your mobile number and password.", request.id);
  }
  if (sessions.isPhoneLocked(phone)) {
    reply.code(429);
    return fail("AUTH_TEMP_LOCKED", "Too many attempts. Please try again later.", request.id);
  }

  const user = await repository.getUserByPhone(phone);
  if (!user) {
    reply.code(401);
    return fail("ACCOUNT_NOT_FOUND", "No account found for this number. Please create one.", request.id);
  }
  if (!credentials.has(user.id)) {
    reply.code(401);
    return fail("PASSWORD_NOT_SET", "This account uses OTP sign-in. Request an OTP instead.", request.id);
  }
  if (!credentials.verify(user.id, password)) {
    sessions.recordOtpFailure(phone, clientIp(request));
    reply.code(401);
    return fail("AUTH_INVALID_PASSWORD", "Incorrect mobile number or password.", request.id);
  }

  sessions.clearOtpFailures(phone);
  return ok(await issueSession(user, request), request.id);
});

/* ---- Session lifecycle --------------------------------------------------- */

app.post("/auth/refresh", async (request, reply) => {
  const body = (request.body ?? {}) as { refreshToken?: string };
  if (!body.refreshToken) {
    reply.code(422);
    return fail("REFRESH_REQUIRED", "Refresh token is required.", request.id);
  }

  try {
    const rotated = sessions.rotate(body.refreshToken, deviceContext(request));
    const session = sessions.getSession(rotated.sessionId);
    const user = session ? await repository.getUserById(session.userId) : undefined;
    if (!session || !user) {
      reply.code(401);
      return fail("REFRESH_INVALID", "Session could not be refreshed.", request.id);
    }
    return ok(
      {
        accessToken: await signAccessToken({
          userId: user.id,
          phone: user.phone,
          roles: user.roles,
          sessionId: session.id
        }),
        refreshToken: rotated.refreshToken,
        expiresIn: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 600)
      },
      request.id
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "REFRESH_INVALID";
    reply.code(401);
    return fail(code, "Your session is no longer valid. Please sign in again.", request.id);
  }
});

app.post("/auth/logout", async (request, reply) => {
  const userId = requireUserId(request);
  const sessionId = headerValue(request, "x-session-id");
  if (!userId || !sessionId) {
    reply.code(401);
    return fail("AUTH_REQUIRED", "Sign in to manage sessions.", request.id);
  }
  sessions.revoke(userId, sessionId);
  return ok({ revoked: true }, request.id);
});

app.post("/auth/logout-all", async (request, reply) => {
  const userId = requireUserId(request);
  if (!userId) {
    reply.code(401);
    return fail("AUTH_REQUIRED", "Sign in to manage sessions.", request.id);
  }
  const keep = headerValue(request, "x-session-id");
  const count = sessions.revokeAll(userId, keep);
  return ok({ revokedSessions: count }, request.id);
});

app.get("/auth/sessions", async (request, reply) => {
  const userId = requireUserId(request);
  if (!userId) {
    reply.code(401);
    return fail("AUTH_REQUIRED", "Sign in to view sessions.", request.id);
  }
  return ok(sessions.listSessions(userId, headerValue(request, "x-session-id")), request.id);
});

app.get("/auth/security-events", async (request, reply) => {
  const userId = requireUserId(request);
  if (!userId) {
    reply.code(401);
    return fail("AUTH_REQUIRED", "Sign in to view security activity.", request.id);
  }
  return ok(sessions.listSecurityEvents(userId), request.id);
});

/* ---- Identity verification (KYC) ----------------------------------------- */

app.get("/verifications/me", async (request, reply) => {
  const userId = requireUserId(request);
  if (!userId) {
    reply.code(401);
    return fail("AUTH_REQUIRED", "Sign in to view verification status.", request.id);
  }
  return ok(verifications.getRecord(userId), request.id);
});

app.post("/verifications", async (request, reply) => {
  const userId = requireUserId(request);
  if (!userId) {
    reply.code(401);
    return fail("AUTH_REQUIRED", "Sign in to verify your profile.", request.id);
  }

  const body = (request.body ?? {}) as Partial<VerificationSubmission>;
  const idType = body.idType;
  const idNumber = (body.idNumber ?? "").trim();
  const idName = (body.idName ?? "").trim();

  if (!idType || !idTypes.includes(idType)) {
    reply.code(422);
    return fail("KYC_ID_TYPE_INVALID", "Choose a valid government ID type.", request.id);
  }
  if (idNumber.length < 4) {
    reply.code(422);
    return fail("KYC_ID_NUMBER_INVALID", "Enter the ID number exactly as printed.", request.id);
  }
  if (idName.length < 2) {
    reply.code(422);
    return fail("KYC_ID_NAME_INVALID", "Enter your name as printed on the ID.", request.id);
  }
  const idImageCheck = validateImageDataUrl(body.idImage);
  if (!idImageCheck.ok) {
    reply.code(422);
    return fail("KYC_ID_PHOTO_INVALID", idImageCheck.reason ?? "Upload a clear photo of your government ID.", request.id);
  }
  const selfieCheck = validateImageDataUrl(body.selfieImage);
  if (!selfieCheck.ok) {
    reply.code(422);
    return fail("KYC_SELFIE_INVALID", selfieCheck.reason ?? "Capture a selfie holding your ID.", request.id);
  }

  const location: KycLocation | null =
    body.location && typeof body.location.lat === "number" && typeof body.location.lng === "number"
      ? { lat: body.location.lat, lng: body.location.lng, accuracy: body.location.accuracy }
      : null;

  const record = verifications.submit(
    userId,
    { idType, idNumber, idName, idImage: body.idImage as string, selfieImage: body.selfieImage as string, location },
    clientIp(request)
  );

  reply.code(201);
  return ok(record, request.id);
});

app.get("/verifications", async (request) => ok(verifications.listPending(), request.id));

app.post("/verifications/:userId/approve", async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const record = verifications.setStatus(userId, "verified");
  if (!record) {
    reply.code(404);
    return fail("KYC_NOT_FOUND", "No verification on file for this user.", request.id);
  }
  return ok(record, request.id);
});

app.post("/verifications/:userId/reject", async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const body = (request.body ?? {}) as { reason?: string };
  const record = verifications.setStatus(userId, "rejected", body.reason);
  if (!record) {
    reply.code(404);
    return fail("KYC_NOT_FOUND", "No verification on file for this user.", request.id);
  }
  return ok(record, request.id);
});

await app.listen({ port, host: "0.0.0.0" });
