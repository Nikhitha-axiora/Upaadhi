import "dotenv/config";
import crypto from "node:crypto";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { fail, ok } from "@upaadhi/shared";
import { signAccessToken } from "@upaadhi/shared/auth";
import { createIdentityRepository } from "./repository.js";

const port = Number(process.env.IDENTITY_PORT ?? process.env.PORT ?? 4101);
const app = Fastify({ logger: true });
const repository = createIdentityRepository();

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

app.post("/auth/otp/request", async (request) => {
  const body = request.body as { phone?: string };
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + Number(process.env.OTP_TTL_SECONDS ?? 300) * 1000);

  if (!body.phone) {
    return fail("PHONE_REQUIRED", "Phone number is required.", request.id);
  }

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

  const isValidOtp = await repository.verifyOtpChallenge(body.phone, hashOtp(body.phone, body.otp));

  if (!isValidOtp) {
    reply.code(401);
    return fail("AUTH_OTP_INVALID", "Invalid verification code.", request.id);
  }

  const user = (await repository.listUsers())[0];

  return ok(
    {
      accessToken: await signAccessToken({
        userId: user.id,
        phone: user.phone,
        roles: user.roles
      }),
      refreshToken: "dev-refresh-token",
      user
    },
    request.id
  );
});

await app.listen({ port, host: "0.0.0.0" });
