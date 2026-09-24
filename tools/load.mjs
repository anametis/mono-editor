import { performance } from "node:perf_hooks";
const origin = process.env.LOAD_ORIGIN;
if (!origin)
  throw new Error(
    "Set LOAD_ORIGIN to an explicitly authorized test environment",
  );
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 10),
  requests = Number(process.env.LOAD_REQUESTS ?? 100);
if (
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 200 ||
  !Number.isInteger(requests) ||
  requests < 1 ||
  requests > 100000
)
  throw new Error("Invalid load parameters");
for (const [name, path, headers] of [
  ["public-cache", "/", { accept: "text/html" }],
  ["uncached-render", "/?load=1", { accept: "text/html" }],
  [
    "authenticated",
    "/api/bookmarks",
    { cookie: process.env.LOAD_COOKIE ?? "" },
  ],
]) {
  if (name === "authenticated" && !process.env.LOAD_COOKIE) {
    console.log(
      "Authenticated scenario skipped: supply LOAD_COOKIE for a test account",
    );
    continue;
  }
  let index = 0,
    failures = 0;
  const timings = [];
  const start = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (index++ < requests) {
        const began = performance.now();
        try {
          const response = await fetch(new URL(path, origin), {
            headers,
            signal: AbortSignal.timeout(10000),
          });
          await response.arrayBuffer();
          if (!response.ok) failures++;
        } catch {
          failures++;
        }
        timings.push(performance.now() - began);
      }
    }),
  );
  timings.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      scenario: name,
      requests,
      concurrency,
      failures,
      requestsPerSecond: requests / ((performance.now() - start) / 1000),
      p95Ms: timings[Math.floor(timings.length * 0.95)],
    }),
  );
  if (failures) process.exitCode = 1;
}
