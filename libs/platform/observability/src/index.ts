import pino from "pino";
import { metrics } from "@opentelemetry/api";
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "password",
      "token",
      "otp",
      "secret",
      "body",
    ],
    remove: true,
  },
});
const meter = metrics.getMeter("kara");
export const publicationCount = meter.createCounter("kara.publications");
export const workerDuration = meter.createHistogram("kara.worker.duration", {
  unit: "ms",
});
export const workerFailures = meter.createCounter("kara.worker.failures");
export const publicationLag = meter.createGauge("kara.publication.lag", {
  unit: "s",
});
