import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { fail, ok, ReportPayload } from "@upaadhi/shared";
import { createTrustRepository } from "./repository.js";

const port = Number(process.env.TRUST_PORT ?? process.env.PORT ?? 4104);
const app = Fastify({ logger: true });
const repository = createTrustRepository();

await app.register(cors, { origin: true });

app.get("/health", async () => ok({ service: "trust-service", status: "ok" }));

app.get("/reports", async (request) => ok(await repository.listReports(), request.id));

app.post("/reports", async (request, reply) => {
  const body = request.body as ReportPayload;

  if (!body.reason || (!body.listingId && !body.reportedUserId)) {
    reply.code(422);
    return fail("REPORT_VALIDATION_FAILED", "Report reason and target are required.", request.id);
  }

  const report = await repository.createReport(body);
  reply.code(201);
  return ok(report, request.id);
});

await app.listen({ port, host: "0.0.0.0" });
