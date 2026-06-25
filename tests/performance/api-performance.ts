import { performance } from "node:perf_hooks";

const apiBase = process.env.API_BASE ?? "http://localhost:4000";
const requests = Number(process.env.PERF_REQUESTS ?? 50);
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 5);
const maxP95Ms = Number(process.env.PERF_MAX_P95_MS ?? 500);

async function timedRequest() {
  const start = performance.now();
  const response = await fetch(`${apiBase}/api/v1/feed`);

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  await response.arrayBuffer();
  return performance.now() - start;
}

const durations: number[] = [];
let next = 0;

async function worker() {
  while (next < requests) {
    next += 1;
    durations.push(await timedRequest());
  }
}

async function main() {
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  durations.sort((a, b) => a - b);
  const p95 = durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)];
  const avg = durations.reduce((sum, item) => sum + item, 0) / durations.length;

  console.log(
    JSON.stringify(
      {
        requests,
        concurrency,
        avgMs: Number(avg.toFixed(2)),
        p95Ms: Number(p95.toFixed(2)),
        maxAllowedP95Ms: maxP95Ms
      },
      null,
      2
    )
  );

  if (p95 > maxP95Ms) {
    throw new Error(`Performance p95 ${p95.toFixed(2)}ms exceeded ${maxP95Ms}ms`);
  }
}

void main();
